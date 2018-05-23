require({cache:{
'url:ibm-themeeditor/templates/ThemeEditorPortlet.html':"<div data-dojo-attach-point=\"main\" class=\"themeEditorPortlet\">\r\n    <div data-dojo-type=\"ibm-themeeditor/ThemeEditorContainer\" data-dojo-attach-point=\"container\"\r\n         data-dojo-props=\"'namespace':'${namespace}'\" id=\"${namespace}container\">\r\n    </div>\r\n</div>"}});
/**
 * @fileOverview Portlet used for the Theme Editor.
 * @author jjlidaka@us.ibm.com, thomas_dinger@us.ibm.com
 * @version: 0.1
 */
define("ibm-themeeditor/ThemeEditorPortlet", ["dojo/_base/declare",
        "dijit/_WidgetBase",
        "dijit/_TemplatedMixin",
        "dijit/_WidgetsInTemplateMixin",
        "dojo/_base/array",
        "dojo/dom-attr",
        "ibm-themeeditor/widgets/fileeditor/FileEditorHelper",
        "ibm-themeeditor/ThemeEditorHelper",
        "ibm-themeeditor/widgets/ThemeEditorUrlProvider",
        "dojo/text!ibm-themeeditor/templates/ThemeEditorPortlet.html",
        "dojo/i18n!ibm-themeeditor/nls/ThemeEditorPortlet",
        /* The following modules are required to load a JavaScript file, but are not referenced in the code. */
        "ibm-themeeditor/ThemeEditorContainer" /* Referenced in template */
       ], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, array, attr, FileEditorHelper,
                    ThemeEditorHelper, ThemeEditorUrlProvider, myTemplate, myI18n) {
    /**
     * This dojo widget provides portlet-level functionality for editing theme files.
     *
     * @name ThemeEditorPortlet
     * @class ibm-themeeditor/ThemeEditorPortlet
     * @extends {dijit/_WidgetBase}
     * @extends {dijit/_TemplatedMixin}
     * @extends {dijit/_WidgetsInTemplateMixin}
     *
     * The following methods are declared by a dojo subclass.
     * @property {Function} inherited
     *
     * The following attach points are defined in the HTML template.
     * @property (ThemeEditorContainer) container - The main container for Theme editor widgets.
     *
     * The following initialization parameters are mixed in as properties:
     * @property {String} lang - The locale to use for localized strings, e.g. "en".
     * @property {String} id - The id of the DOM element for this widget.
     * @property {String} namespace - The portlet namespace.
     * @property {String} characterEncoding - The character encoding to be used, e.g. "UTF-8".
     * @property {String} actionURL - URL for accessing the server.
     * @property {String} clientMsgKey -
     * @property {Boolean} traceEnabled - Whether trace output should be sent to the console.
     * @property {Object} theme - The theme properties required to identify the theme.
     * @property {String} theme.id - The theme OID.
     * @property {String} theme.name - The theme title.
     * @property {String} theme.modifiedDate - The last modified date of the theme.
     * @property {String} theme.type - "dav", "war", or "other".
     * @property {String} treeUrl - The url for tree XHR requests (retrieve).
     * @property {String} fileUrl - The url for file XHR requests (CRUD).
     * @property {Object} action - The action to be executed when the editor is opened.
     * @property {String} action.name - The name of the action.
     * @property {String} action.target - The target of the action.
     * @property {String} action.params - The params of the action.
     */
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        /**
         * Markup template.
         * @protected
         * @type String
         */
        templateString: myTemplate,

        /**
         * Make i18n available to the template
         * @private
         * @type Object
         */
        i18n: myI18n,

        /**
         * Create and initialize the widget. This method is called when a widget is created programmatically or when a
         * widget is declared in an HTML document (e.g. template).
         *
         * @function constructor
         * @param {Object} params The initialization parameters for the dojo widget.
         * @memberOf ThemeEditorPortlet
         */
        constructor: function (params) {
            if (FileEditorHelper.isSet(params.traceEnabled) && params.traceEnabled === true) {
                FileEditorHelper.setTraceEnabled(true);
            }
            if (ThemeEditorHelper.isSet(params.traceEnabled) && params.traceEnabled === true) {
                ThemeEditorHelper.setTraceEnabled(true);
            }

            ThemeEditorHelper.trace("ThemeEditorPortlet.js", "constructor()", params);
        },

        /**
         * Set any values (e.g. localized strings) that are required by the template. This method is called after the
         * widget has been constructed and before the template is processed.
         *
         * @override
         * @function postMixInProperties
         * @memberOf ThemeEditorPortlet
         */
        postMixInProperties: function () {
            ThemeEditorHelper.trace("ThemeEditorPortlet.js", "postMixInProperties()");

            this.inherited(arguments);

            // Process the attributes handed over by the portlet
            FileEditorHelper.setNamespace(this.namespace);
            ThemeEditorHelper.setNamespace(this.namespace);
            ThemeEditorHelper.setTheme(this.theme);
            var urlOptions = {'theme': this.theme, 'treeUrl': this.treeUrl, 'fileUrl': this.fileUrl};
            FileEditorHelper.setUrlProvider(new ThemeEditorUrlProvider(urlOptions));
            ThemeEditorHelper.setActionURL(this.actionURL);
        },

        /**
         * Set values and call methods on child widgets. This method is called after all child widgets have been
         * created, but before the widget's template has been added to the document.
         *
         * @override
         * @function postCreate
         * @memberOf ThemeEditorPortlet
         */
        postCreate: function () {
            ThemeEditorHelper.trace("ThemeEditorPortlet.js", "postCreate()");

            this.inherited(arguments);

            if (this.clientMsgKey) {
                ThemeEditorHelper.showMessage(this.clientMsgKey, false, null);
            }
        },

        /**
         * Handle any remaining logic before the widget is ready. This method is called after all widgets on the page
         * have been created and the parent widget's startup() method has been called.
         *
         * @override
         * @function startup
         * @memberOf ThemeEditorPortlet
         */
        startup: function () {
            ThemeEditorHelper.trace("ThemeEditorPortlet.js", "startup()");

            this.inherited(arguments);
        },

        /**
         * Destroy the widget. Disconnect all event handlers created in this widget.
         *
         * @override
         * @function destroy
         * @memberOf ThemeEditorPortlet
         */
        destroy: function () {
            ThemeEditorHelper.trace("ThemeEditorPortlet.js", "destroy()");

            this.inherited(arguments);
        }
    });
});
