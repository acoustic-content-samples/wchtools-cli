/**
 * @fileOverview Top-level functionality for the Theme Editor.
 * @author thomas_dinger@us.ibm.com
 * @version: 0.1
 */
define("ibm-themeeditor/widgets/ThemeEditor", ["dojo/_base/declare",
        "ibm-themeeditor/widgets/fileeditor/FileEditor",
        "ibm-themeeditor/widgets/ThemeFileTreeMenu",
        "ibm-themeeditor/widgets/ThemeEditorHeader",
        "ibm-themeeditor/ThemeEditorHelper"
       ], function (declare, FileEditor, ThemeFileTreeMenu, ThemeEditorHeader, ThemeEditorHelper) {
    /**
     * This dojo widget provides functionality for editing theme files.
     *
     * @name ThemeEditor
     * @class ibm-themeeditor/widgets/ThemeEditor
     * @extends {FileEditor}
     *
     * The following methods are declared by a dojo subclass.
     * @property {Function} inherited
     *
     * The following initialization parameters are mixed in as properties:
     * @property {String} lang - The locale to use for localized strings, e.g. "en".
     * @property {String} dojoAttachPoint - The property name of this widget on the parent object.
     * @property {String} namespace - The portlet namespace.
     * @property {Boolean} template - Whether this widget has an associated template.
     */
    return declare([FileEditor], {
        /**
         * Widget that handles the context menu functionality for the tree.
         * @private
         * @type ibm-themeeditor/widgets/ThemeTreeFileMenu
         */
        contextMenu: null,

        /**
         * Whether to create the context menu widget for the tree.
         * @private
         * @type Boolean
         */
        createContextMenu: false,

        /**
         * Create and initialize the widget. This method is called when a widget is created programmatically or when a
         * widget is declared in an HTML document (e.g. template).
         *
         * @function constructor
         * @param {Object} params The initialization parameters for the dojo widget.
         * @memberOf ThemeEditor
         */
        constructor: function (params) {
            ThemeEditorHelper.trace("ThemeEditor.js", "constructor()", params);
        },

        /**
         * Set any values (e.g. localized strings) that are required by the template. This method is called after the
         * widget has been constructed and before the template is processed.
         *
         * @override
         * @function postMixInProperties
         * @memberOf ThemeEditor
         */
        postMixInProperties: function () {
            ThemeEditorHelper.trace("ThemeEditor.js", "postMixInProperties()");

            this.inherited(arguments);
        },

        /**
         * Set values and call methods on child widgets. This method is called after all child widgets have been
         * created, but before the widget's template has been added to the document.
         *
         * @override
         * @function postCreate
         * @memberOf ThemeEditor
         */
        postCreate: function () {
            ThemeEditorHelper.trace("ThemeEditor.js", "postCreate()");

            this.inherited(arguments);

            // Create the ThemeEditorHeader, which will inject the theme-related elements into the file editor header.
            // Note, because the ThemeEditorHeader elements are injected into other elements, calling startup() on the
            // ThemeEditorHeader widget is not necessary.
            //noinspection JSLint
            new ThemeEditorHeader({'lang': this.lang, 'namespace': this.namespace, 'header': this.header});

            if (this.createContextMenu) {
                // Create the context menu for the items in the tree.
                this.contextMenu = new ThemeFileTreeMenu({"lang": this.lang, "namespace": this.namespace});
            }
        },

        /**
         * Handle any remaining logic before the widget is ready. This method is called after all widgets on the page
         * have been created and the parent widget's startup() method has been called.
         *
         * @override
         * @function startup
         * @memberOf ThemeEditor
         */
        startup: function () {
            ThemeEditorHelper.trace("ThemeEditor.js", "startup()");

            this.inherited(arguments);

            if (this.contextMenu) {
                this.contextMenu.startup();
            }
        },

        /**
         * Destroy the widget. Disconnect all event handlers created in this widget.
         *
         * @override
         * @function destroy
         * @memberOf ThemeEditor
         */
        destroy: function () {
            ThemeEditorHelper.trace("ThemeEditor.js", "destroy()");

            this.inherited(arguments);
        }
    });
});
