import $ from 'jquery';

import {basicSetup, EditorView } from "codemirror";
import {sql} from "@codemirror/lang-sql"
import {languages} from "@codemirror/language-data"

import cookie from 'cookiejs';
import List from 'list.js'

import 'floatthead'


function editorFromTextArea(textarea) {
    let view = new EditorView({
        doc: textarea.value,
        extensions: [
            basicSetup,
            sql({codeLanguages: languages}),
        ]})
    textarea.parentNode.insertBefore(view.dom, textarea)
    textarea.style.display = "none"
    if (textarea.form) textarea.form.addEventListener("submit", () => {
        textarea.value = view.state.doc.toString()
    })
    return view
}

export class ExplorerEditor {
    constructor(queryId) {
        this.queryId = queryId;
        this.$table = $("#preview");
        this.$rows = $("#rows");
        this.$form = $("form");
        this.$snapshotField = $("#id_snapshot");
        this.$paramFields = this.$form.find(".param");

        this.$submit = $("#refresh_play_button, #save_button");
        if (!this.$submit.length) {
            this.$submit = $("#refresh_button");
        }

        this.editor = editorFromTextArea(document.getElementById("id_sql"));

        this.bind();

        if (cookie.get("schema_sidebar_open") === 'true') {
            this.showSchema(true);
        }
    }

    getParams() {
        var o = false;
        if(this.$paramFields.length) {
            o = {};
            this.$paramFields.each(function() {
                o[$(this).data("param")] = $(this).val();
            });
        }
        return o;
    }

    serializeParams(params) {
        var args = [];
        for(var key in params) {
            args.push(key + ":" + params[key]);
        }
        return encodeURIComponent(args.join("|"));
    }

    doCodeMirrorSubmit() {
        // Captures the cmd+enter keystroke and figures out which button to trigger.
        this.$submit.click();
    }

    savePivotState(state) {
        let bmark = btoa(JSON.stringify(_(state).pick("aggregatorName", "rows", "cols", "rendererName", "vals")));
        let $el = $("#pivot-bookmark");
        $el.attr("href", $el.data("baseurl") + "#" + bmark);
    }

    updateQueryString(key, value, url) {
        // http://stackoverflow.com/a/11654596/221390
        if (!url) url = window.location.href;
        var re = new RegExp("([?&])" + key + "=.*?(&|#|$)(.*)", "gi"),
            hash = url.split("#");

        if (re.test(url)) {
            if (typeof value !== "undefined" && value !== null)
                return url.replace(re, "$1" + key + "=" + value + "$2$3");
            else {
                url = hash[0].replace(re, "$1$3").replace(/(&|\?)$/, "");
                if (typeof hash[1] !== "undefined" && hash[1] !== null)
                    url += "#" + hash[1];
                return url;
            }
        }
        else {
            if (typeof value !== "undefined" && value !== null) {
                var separator = url.indexOf("?") !== -1 ? "&" : "?";
                url = hash[0] + separator + key + "=" + value;
                if (typeof hash[1] !== "undefined" && hash[1] !== null)
                    url += "#" + hash[1];
                return url;
            }
            else
                return url;
        }
    }

    formatSql() {
        $.post("../format/", {sql: this.editor.getValue() }, function(data) {
            this.editor.setValue(data.formatted);
        }.bind(this));
    }

    showRows() {
        var rows = this.$rows.val(),
            $form = $("#editor");
        $form.attr("action", this.updateQueryString("rows", rows, window.location.href));
        $form.submit();
    }

    showSchema(noAutofocus) {
        $("#schema_frame").attr("src", "../schema/" + $("#id_connection").val());
        if (noAutofocus === true) {
            $("#schema_frame").addClass("no-autofocus");
        }
        $("#query_area").removeClass("col").addClass("col-9");
        var schema$ = $("#schema");
        schema$.addClass("col-md-3");
        schema$.show();
        $("#show_schema_button").hide();
        $("#hide_schema_button").show();
        cookie.set("schema_sidebar_open", 'true');
        return false;
    }

    hideSchema() {
        $("#query_area").removeClass("col-9").addClass("col");
        var schema$ = $("#schema");
        schema$.removeClass("col-3");
        schema$.hide();
        $(this).hide();
        $("#show_schema_button").show();
        cookie.set("schema_sidebar_open", 'false');
        return false;
    }

    bind() {
        $("#show_schema_button").click(this.showSchema);
        $("#hide_schema_button").click(this.hideSchema);

        $("#format_button").click(function(e) {
            e.preventDefault();
            this.formatSql();
        }.bind(this));

        $("#rows").keyup(function() {
            var curUrl = $("#fullscreen").attr("href");
            var newUrl = curUrl.replace(/rows=\d+/, "rows=" + $("#rows").val());
            $("#fullscreen").attr("href", newUrl);
        }.bind(this));

        $("#save_button").click(function() {
            var params = this.getParams(this);
            if(params) {
                this.$form.attr("action", "../" + this.queryId + "/?params=" + this.serializeParams(params));
            }
            this.$snapshotField.hide();
            this.$form.append(this.$snapshotField);
        }.bind(this));

        $("#refresh_button").click(function(e) {
            e.preventDefault();
            var params = this.getParams();
            if(params) {
                window.location.href = "../" + this.queryId + "/?params=" + this.serializeParams(params);
            } else {
                window.location.href = "../" + this.queryId + "/";
            }
        }.bind(this));

        $("#refresh_play_button").click(function() {
            this.$form.attr("action", "../play/");
        }.bind(this));

        $("#playground_button").click(function(e) {
            e.preventDefault();
            this.$form.attr("action", "../play/?show=0");
            this.$form.submit();
        }.bind(this));

        $("#create_button").click(function() {
            this.$form.attr("action", "../new/");
        }.bind(this));

        $(".download-button").click(function(e) {
            var url = "../download?format=" + $(e.target).data("format");
            var params = this.getParams();
            if(params) {
                url = url + "&params=" + params;
            }
            this.$form.attr("action", url);
        }.bind(this));

        $(".download-query-button").click(function(e) {
            var url = "../download?format=" + $(e.target).data("format");
            var params = this.getParams();
            if(params) {
                url = url + "&params=" + params;
            }
            this.$form.attr("action", url);
        }.bind(this));

        $(".stats-expand").click(function(e) {
            e.preventDefault();
            $(".stats-expand").hide();
            $(".stats-wrapper").show();
            this.$table.floatThead("reflow");
        }.bind(this));

        $("#counter-toggle").click(function(e) {
            e.preventDefault();
            $(".counter").toggle();
            this.$table.floatThead("reflow");
        }.bind(this));

        $(".sort").click(function(e) {
            var t = $(e.target).data("sort");
            var dir = $(e.target).data("dir");
            $(".sort").addClass("bi-arrow-down-up");
            $(".sort").removeClass("bi-arrow-down");
            $(".sort").removeClass("bi-arrow-up");
            if (dir === "asc"){
                $(e.target).data("dir", "desc");
                $(e.target).addClass("bi-arrow-up");
                $(e.target).removeClass("bi-arrow-down");
                $(e.target).removeClass("bi-arrow-down-up");
            } else {
                $(e.target).data("dir", "asc");
                $(e.target).addClass("bi-arrow-down");
                $(e.target).removeClass("bi-arrow-up");
                $(e.target).removeClass("bi-arrow-down-up");
            }
            var vals = [];
            var ct = 0;
            while (ct < this.$table.find("th").length) {
               vals.push(ct++);
            }
            var options = {
                valueNames: vals
            };
            var tableList = new List("preview", options);
            tableList.sort(t, { order: dir });
        }.bind(this));

        $("#preview-tab-label").click(function() {
            this.$table.floatThead("reflow");
        }.bind(this));

        var pivotState = window.location.hash;
        var navToPivot = false;
        if (!pivotState) {
            pivotState = {onRefresh: this.savePivotState};
        } else {
            try {
                pivotState = JSON.parse(atob(pivotState.substr(1)));
                pivotState["onRefresh"] = this.savePivotState;
                navToPivot = true;
            } catch(e) {
                pivotState = {onRefresh: this.savePivotState};
            }
        }
        // TODO implement pivot tables
        //$(".pivot-table").pivotUI(this.$table, pivotState);
        if (navToPivot) {
            $("#pivot-tab-label").tab("show");
        }

        setTimeout(function() {
            this.$table.floatThead({
                scrollContainer: function() {
                                    return this.$table.closest(".overflow-wrapper");
                                }.bind(this)
            });
        }.bind(this), 1);

        this.$rows.change(function() { this.showRows(); }.bind(this));
        this.$rows.keyup(function(event) {
            if(event.keyCode === 13){ this.showRows(); }
        }.bind(this));
    }
}

// TODO make this work again
$(window).on("beforeunload", function () {
    // Only do this if changed-input is on the page and we"re not on the playground page.
    if ($(".changed-input").length && !$(".playground-form").length) {
        return "You have unsaved changes to your query.";
    }
});

// Disable unsaved changes warning when submitting the editor form
$(document).on("submit", "#editor", function(event){
    // disable warning
    $(window).off("beforeunload");
});
