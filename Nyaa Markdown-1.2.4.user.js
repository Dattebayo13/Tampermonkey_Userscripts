// ==UserScript==
// @name         Nyaa Markdown
// @version      1.2.4
// @description  Copy and preview markdown with proper BBCode tables
// @author       Jimbo (modified by Dattebayo13)
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @match        https://nyaa.si/view/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/markdown-it/8.3.1/markdown-it.min.js
// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/refs/heads/master/html2bbcode.min.js
// ==/UserScript==

(function() {
    'use strict';

    const markdownOptions = {
        html: false,
        breaks: true,
        linkify: true,
        typographer: true
    }
    const markdown = markdownit(markdownOptions);
    markdown.renderer.rules.table_open = function(tokens, idx) {
        return '<table class="table table-striped table-bordered" style="width: auto;">';
    }
    var defaultRender = markdown.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    }
    markdown.renderer.rules.link_open = function(tokens, idx, options, env, self) {
        tokens[idx].attrPush(['rel', 'noopener nofollow noreferrer']);
        return defaultRender(tokens, idx, options, env, self);
    }

    const gfm = turndownPluginGfm.gfm
    const turndownService = new TurndownService()
    turndownService.use(gfm)

    function convertTables(html) {
        return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, function(match, content) {
            let rows = [];

            content.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, function(rowMatch, rowContent) {
                let cells = [];

                rowContent.replace(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi, function(cellMatch, tag, cellContent) {
                    var converter = new html2bbcode.HTML2BBCode({
                        noheadings: true,
                        nolist: false
                    });
                    let converted = converter.feed(cellContent).toString().trim();
                    if (tag.toLowerCase() === "th") {
                        converted = `[b]${converted}[/b]`;
                    }
                    cells.push(converted);
                    return '';
                });

                if (cells.length > 0) {
                    rows.push('[tr]\n  [td]' + cells.join('[/td]\n  [td]') + '[/td]\n[/tr]');
                }
                return '';
            });

            return '[table]\n' + rows.join('\n') + '\n[/table]';
        });
    }

    const submit = document.querySelector('#collapse-comments > form > div:nth-child(2) > div > input')

    if (submit) {
        GM_addStyle('button.btn-preview {margin-left: 5px; color: #fff; background-color: #247fcc; border-color: #247fcc;}')
        GM_addStyle('button.btn-preview:hover {margin-left: 5px; color: #fff; background-color: #19578b; border-color: #19578b;}')
        GM_addStyle('.form-control[hidden] {display: none;}')
        GM_addStyle('.md-preview {height: 8em; overflow: hidden; overflow-y: auto; resize: vertical;}')

        submit?.insertAdjacentHTML("afterend", '<button type="button" id="md-preview" class="btn btn-sm btn-preview">Preview</button>')

        const button_pre = document.querySelector('button#md-preview')

        const comment_input = document.querySelector('textarea#comment')
        comment_input?.insertAdjacentHTML("afterend", '<div class="md-preview form-control"></div>')
        const preview = comment_input?.nextElementSibling;
        preview.hidden = true

        button_pre.onclick = () => {

            const isCommentHidden = comment_input.hidden;
            comment_input.hidden = !isCommentHidden;
            preview.hidden = isCommentHidden;

            console.log(comment_input.value);
            console.log(markdown.render(comment_input.value));

            preview.innerHTML = markdown.render(comment_input.value);
        }
    }
    const buttonrow = document.querySelector('body > div > div:nth-child(1) > div.panel-footer.clearfix')

    GM_addStyle('button.btn-copy {margin-right: 5px; color: #fff; background-color: #247fcc; border-color: #247fcc;}')
    GM_addStyle('button.btn-copy:hover {margin-right: 5px; color: #fff; background-color: #19578b; border-color: #19578b;}')
    buttonrow?.insertAdjacentHTML("beforeend", '<button type="button" id="md-copy" class="btn btn-xs btn-copy pull-right">Copy Markdown</button>')
    buttonrow?.insertAdjacentHTML("beforeend", '<button type="button" id="bb-copy" class="btn btn-xs btn-copy pull-right">Copy BBCode</button>')

    const button_cpy = document.querySelector('button#md-copy')
    const md_info = document.querySelector('#torrent-description')

    button_cpy.onclick = () => {
        GM_setClipboard(turndownService.turndown(md_info))
    }

    const button_cpy_bb = document.querySelector('button#bb-copy')
    button_cpy_bb.onclick = (event) => {
        let htmlWithBBCodeTables = convertTables(md_info.innerHTML);

        var converter = new html2bbcode.HTML2BBCode({noheadings: true, nolist: false});
        var bbcode = converter.feed(htmlWithBBCodeTables).toString();

        bbcode = bbcode.replace(/\[table\]\s*/g, '[table]\n');
        bbcode = bbcode.replace(/\s*\[\/table\]/g, '\n[/table]');
        bbcode = bbcode.replace(/\[tr\]\s*/g, '[tr]\n  ');
        bbcode = bbcode.replace(/\s*\[\/tr\]/g, '\n[/tr]');
        bbcode = bbcode.replace(/\[\/td\]\s*\[td\]/g, '[/td]\n  [td]');

        if (event.shiftKey) {
            var uploader = document.querySelector('body > div > div:nth-child(1) > div.panel-body > div:nth-child(2) > div:nth-child(2)').innerText
            if (uploader.search(/Anonymous\s\(.*\)/) != -1) uploader = "Anonymous"
            bbcode = `[quote=${uploader}@Nyaa]\n${bbcode}\n[/quote]`
        }
        GM_setClipboard(bbcode)
    }
})();
