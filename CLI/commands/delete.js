/*
Copyright IBM Corporation 2016, 2017

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
"use strict";

const BaseCommand = require("../lib/baseCommand");

const ToolsApi = require("wchtools-api");
const options = ToolsApi.getOptions();
const manifests = ToolsApi.getManifests();
const utils = ToolsApi.getUtils();
const events = require("events");
const i18n = utils.getI18N(__dirname, ".json", "en");
const prompt = require("prompt");
const Q = require("q");

const PREFIX = "========== ";
const SUFFIX = " ===========";

// Constants used to get display strings for an artifact type.
const DISPLAY_NAME = "name";
const DISPLAY_DELETE_BANNER = "banner";
const DISPLAY_PREVIEW_BANNER = "preview";

class DeleteCommand extends BaseCommand {
    /**
     * Create a DeleteCommand object.
     *
     * @param {object} program A Commander program object.
     */
    constructor (program) {
        super(program);
    }

    handleValidation () {
        const deferred = Q.defer();
        const self = this;
        let errorMessage;

        const webassets = self.getCommandLineOption("webassets");
        const assets = self.getCommandLineOption("assets");
        const content = self.getCommandLineOption("content");
        const defaultContent = self.getCommandLineOption("defaultContent");
        const types = self.getCommandLineOption("types");
        const layouts = self.getCommandLineOption("layouts");
        const layoutMappings = self.getCommandLineOption("layoutMappings");
        const sites = self.getCommandLineOption("sites");
        const pages = self.getCommandLineOption("pages");
        const ready = self.getCommandLineOption("ready");
        const draft = self.getCommandLineOption("draft");
        const id = self.getCommandLineOption("id");
        const path = self.getCommandLineOption("path");
        const named = self.getCommandLineOption("named");
        const siteContext = self.getCommandLineOption("siteContext");
        const tag = self.getCommandLineOption("tag");
        const byTypeName = self.getCommandLineOption("byTypeName");
        const recursive = self.getCommandLineOption("recursive");
        const all = self.getCommandLineOption("all");
        const manifest = self.getCommandLineOption("manifest");
        const pageContent = self.getCommandLineOption("pageContent");
        let helper;

        // Handle the various validation checks.
        if (manifest) {
            if (all) {
                // Delete all and delete by manifest are mutually exclusive.
                errorMessage = i18n.__("cli_delete_all_no_manifest");
            }
        } else if (all) {
            if (self.getOptionArtifactCount() === 0) {
                // Delete all requires at least one artifact type to be specified.
                errorMessage = i18n.__("cli_delete_all_no_type");
            } else if (self.getCommandLineOption("preview")) {
                // Delete all does not support preview.
                errorMessage = i18n.__("cli_delete_all_no_preview");
            }
        } else if (tag) {
            if (self.getOptionArtifactCount() === 0) {
                // Delete by tag requires at least one artifact type to be specified.
                errorMessage = i18n.__("cli_delete_no_type");
            } else {
                // Delete by tag is valid for content items, content types, and content assets.
                let validCount = 0;
                if (content) {
                    validCount++;
                }
                if (types) {
                    validCount++;
                }
                if (assets) {
                    validCount++;
                }
                // Must specify one of content, types, or assets; and no other artifact types.
                if (validCount === 0 || validCount !== self.getOptionArtifactCount()) {
                    errorMessage = i18n.__('cli_delete_by_tag_not_supported');
                }
            }
        } else {
            if (self._optionArtifactCount > 1) {
                // Attempting to delete multiple artifact types.
                errorMessage = i18n.__('cli_delete_only_one_type');
            } else if (webassets) {
                helper = ToolsApi.getAssetsHelper();
                self.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
            } else if (assets) {
                helper = ToolsApi.getAssetsHelper();
                self.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
            } else if (layouts) {
                helper = ToolsApi.getLayoutsHelper();
            } else if (layoutMappings) {
                helper = ToolsApi.getLayoutMappingsHelper();
            } else if (content) {
                helper = ToolsApi.getContentHelper();
            } else if (defaultContent) {
                helper = ToolsApi.getDefaultContentHelper();
            } else if (sites) {
                helper = ToolsApi.getSitesHelper();
            } else if (pages) {
                helper = ToolsApi.getPagesHelper();
            } else if (types) {
                helper = ToolsApi.getItemTypeHelper();
            }

            if (!errorMessage) {
                if (!helper) {
                    // Must specify one of the supported artifact types.
                    errorMessage = i18n.__('cli_delete_no_type');
                } else {
                    // Make sure the combination of specified options is valid.
                    if ((content || defaultContent) && !(id || named || byTypeName)) {
                        // Content items require either the --id, --named, or --by-type-name option.
                        errorMessage = i18n.__('cli_delete_requires_id_name_bytypename');
                    } else if (types && !(id || named)) {
                        // Content types require either the --id or --named option.
                        errorMessage = i18n.__('cli_delete_requires_id_name');
                    } else if (webassets && !(path || named)) {
                        // Web assets require either the --path or --named option.
                        errorMessage = i18n.__('cli_delete_path_required');
                    } else if (assets && !(path || named)) {
                        // Content assets require either the --path or --named option (or --tag which is handled above).
                        errorMessage = i18n.__('cli_delete_path_tag_required');
                    } else if (sites && !siteContext) {
                        // Sites require the --site-context option.
                        errorMessage = i18n.__('cli_delete_siteContext_required');
                    } else if (pages && !(id || (path && siteContext))) {
                        // Pages require either the id option or both the --path and --site-context options.
                        errorMessage = i18n.__('cli_delete_requires_id_or_path_and_siteContext');
                    } else if ((layouts || layoutMappings) && !(id || path)) {
                        // Layouts and layout mappings require either the --id or --path option.
                        errorMessage = i18n.__('cli_delete_no_id_or_path');
                    } else if (id && path) {
                        // The --id and --path options cannot both be specified.
                        errorMessage = i18n.__('cli_delete_both_id_and_path');
                    } else if (id && ready && draft) {
                        // The --id option cannot be specified with both ready and draft.
                        errorMessage = i18n.__('cli_delete_id_ready_draft');
                    } else if (id && !helper.supportsDeleteById()) {
                        // The --id option is only valid for artifact types that support it.
                        errorMessage = i18n.__('cli_delete_by_id_not_supported');
                    } else if (path && !helper.supportsDeleteByPath() && !helper.supportsDeleteByPathRecursive()) {
                        // The --path option is only valid for artifact types that support it.
                        errorMessage = i18n.__('cli_delete_by_path_not_supported');
                    } else if (recursive && !helper.supportsDeleteByPathRecursive()) {
                        // The --recursive option is only valid for artifact types that support it.
                        errorMessage = i18n.__('cli_delete_recursive_not_supported');
                    } else if (pageContent && !pages) {
                        // The --page-content option is only valid for pages.
                        errorMessage = i18n.__('cli_delete_page_content_req_pages');
                    }
                }
            }
        }

        // If --page-content specified when deleting pages then set flag to delete page content too. Not needed when
        // also deleting content, since pages and content can only be specified together when deleting all artifacts.
        if (pages && pageContent && !content) {
            self.setApiOption("delete-content", true);
        }

        if (errorMessage) {
            deferred.reject(new Error(errorMessage));
        } else {
            deferred.resolve();
        }
        return deferred.promise;
    }

    /**
     * Handle the site-context option specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the specified site-context option is valid, otherwise reject to indicate that
     *          command execution should not continue.
     */
    handleSiteContextOption() {
        if (this.getCommandLineOption("pages") && this.getCommandLineOption("id") && !this.getCommandLineOption("siteContext")) {
            // For backward compatibility, deleting a page by id uses the "default" site if no site-context was specified.
            this.setCommandLineOption("siteContext", "default");
        }

        return super.handleSiteContextOption();
    }

    /**
     * Handle the ready and draft options specified on the command line.
     *
     * @returns {Q.Promise} Resolve if the specified ready and draft options are valid, otherwise reject to
     *          indicate that command execution should not continue.
     */
    handleReadyDraftOptions() {
        const result = super.handleReadyDraftOptions();

        const all = this.getCommandLineOption("all");
        const draft = this.getCommandLineOption("draft");

        // Using --all with --draft is allowed - it will delete all draft items.
        // But using --all with --ready or with neither --draft nor --ready should have
        // the behavior of deleting all ready items including their drafts.
        if (all && !draft) {
            // Unset any filtering set by the super class impl.
            this.setApiOption("filterReady", undefined);
            this.setApiOption("filterDraft", undefined);
        }

        return result;
    }

    /**
     * Determine whether this command should include draft sites.
     *
     * @returns {Boolean} A return value of true indicates that this command should include draft sites. A return value
     *                    of false indicates that this command should not include draft sites.
     */
    includeDraftSites() {
        let retVal = super.includeDraftSites();

        if (!retVal) {
            // Handle the cases where the delete command needs to include draft sites even if --draft was not specified.
            if (this.getCommandLineOption("all")) {
                // Always include draft sites for the delete --all command because ALL artifacts must be deleted.
                retVal = true;
            } else {
                if (this.getCommandLineOption("siteContext") && !this.getCommandLineOption("id")) {
                    // For the case of deleting a site, always include the draft sites. The draft sites will need to be
                    // cancelled before deleting the ready site. (The id option is never defined when deleting sites.)
                    // For the case of deleting a page by path, always include the draft sites. As with sites, the draft
                    // pages will need to be cancelled before deleting the ready page. However, for the case of deleting
                    // a page by id, draft sites are not always included. A ready page has a different id than its draft
                    // pages, so trying to delete a page with the specified id across different sites won't work anyway.
                    retVal = true;
                }
            }
        }

        return retVal;
    }

    /**
     * Delete the specified artifact(s).
     */
    doDelete () {
        // Create the context for deleting the specified artifact(s).
        const toolsApi = new ToolsApi({eventEmitter: new events.EventEmitter()});
        const context = toolsApi.getContext();
        const self = this;
        const logger = self.getLogger();

        // Make sure the "dir" option can be handled successfully.
        self.handleDirOption(context)
            .then(function () {
                // Make sure the url option has been specified.
                return self.handleUrlOption(context)
            })
            .then(function () {
                // Make sure the user name and password have been specified.
                return self.handleAuthenticationOptions(context);
            })
            .then(function () {
                // Login using the current options.
                return self.handleLogin(context, self.getApiOptions());
            })
            .then(function () {
                // Handle the manifest options.
                return self.handleManifestOptions(context);
            })
            .then(function () {
                // Make sure the artifact type options are valid.
                return self.handleArtifactTypes(context);
            })
            .then(function () {
                // Validate the options.
                return self.handleValidation();
            })
            .then(function () {
                // Handle the site-context option.
                return self.handleSiteContextOption();
            })
            .then(function () {
                // Handle the ready and draft options.
                return self.handleReadyDraftOptions();
            })
            .then(function () {
                // Check to see if the initialization process was successful.
                return self.handleInitialization(context);
            })
            .then(function () {
                // Initialize the list of remote sites to be used for this command, if necessary.
                return self.initSites(context, true, self.getApiOptions());
            })
            .then(function () {
                const webassets = self.getCommandLineOption("webassets");
                const assets = self.getCommandLineOption("assets");
                const content = self.getCommandLineOption("content");
                const defaultContent = self.getCommandLineOption("defaultContent");
                const types = self.getCommandLineOption("types");
                const layouts = self.getCommandLineOption("layouts");
                const layoutMappings = self.getCommandLineOption("layoutMappings");
                const sites = self.getCommandLineOption("sites");
                const pages = self.getCommandLineOption("pages");
                const id = self.getCommandLineOption("id");
                const path = self.getCommandLineOption("path");
                const named = self.getCommandLineOption("named");
                const siteContext = self.getCommandLineOption("siteContext");
                const tag = self.getCommandLineOption("tag");
                const byTypeName = self.getCommandLineOption("byTypeName");
                const all = self.getCommandLineOption("all");
                const manifest = self.getCommandLineOption("manifest");
                let helper;
                if (webassets) {
                    helper = ToolsApi.getAssetsHelper();
                    self.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
                } else if (assets) {
                    helper = ToolsApi.getAssetsHelper();
                    self.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
                } else if (layouts) {
                    helper = ToolsApi.getLayoutsHelper();
                } else if (layoutMappings) {
                    helper = ToolsApi.getLayoutMappingsHelper();
                } else if (content) {
                    helper = ToolsApi.getContentHelper();
                } else if (defaultContent) {
                    helper = ToolsApi.getDefaultContentHelper();
                } else if (sites) {
                    helper = ToolsApi.getSitesHelper();
                } else if (pages) {
                    helper = ToolsApi.getPagesHelper();
                } else if (types) {
                    helper = ToolsApi.getItemTypeHelper();
                }

                if (all) {
                    // Handle delete all, which can have multiple artifact types specified.
                    return self.deleteAll(context);
                } else if (manifest) {
                    // Handle delete by manifest, which can define multiple artifact types.
                    return self.deleteByManifest(context);
                } else if (tag) {
                    // Handle delete by tag, which can also have multiple artifact types specified.
                    return self.deleteByTag(context, tag);
                } else if (sites) {
                    // Handle delete of sites.
                    return self.deleteSites(context, siteContext);
                } else if (pages) {
                    // Handle delete of pages.
                    if (id) {
                        return self.deletePageById(helper, context, id);
                    } else {
                        return self.deletePagesByPath(helper, context, path);
                    }
                } else if (layouts || layoutMappings) {
                    // Handle delete of layouts or layout mappings.
                    if (id) {
                        return self.deleteById(helper, context, id);
                    } else {
                        return self.deleteByPath(helper, context, path);
                    }
                } else if (webassets || assets) {
                    // Handle delete of assets or web assets. The tag option is handled above, so handle path or named.
                    return self.deleteByPathSearch(helper, context, path || named);
                } else {
                    // Handle delete of content items and content types.
                    if (content && byTypeName) {
                        // The by-type-name option is only valid for content.
                        return self.deleteBySearch(helper, context, "type", byTypeName);
                    } else if (id) {
                        // The id option is valid for both content items and content types.
                        return self.deleteById(helper, context, id);
                    } else {
                        // The named option is valid for both content items and content types.
                        return self.deleteBySearch(helper, context, "name", named);
                    }
                }
            })
            .then(function (results) {
                // Save the results to a manifest, if one was specified.
                try {
                    // Save the manifests.
                    self.saveManifests(context);
                } catch (err) {
                    // Log the error that occurred while saving the manifest, but do not fail the delete operation.
                    logger.error(i18n.__("cli_save_manifest_failure", {"err": err.message}));
                }

                return results;
            })
            .catch(function (err) {
                // Don't log an error whose "noLog" property has been set.
                if (!err["noLog"]) {
                    logger.error(i18n.__("cli_delete_error", {"err": err.toString()}));
                }
                self.errorMessage(err.message);
            })
            .finally(function () {
                // Reset the list of sites used for this command.
                self.resetSites(context);

                // Reset the command line options once the command has completed.
                self.resetCommandLineOptions();
            });
    }

    /**
     * Delete the sites with the specified context root.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} siteContext The context root of the site to delete.
     */
    deleteSites(context, siteContext) {
        const helper = ToolsApi.getSitesHelper();

        // Display the context name for deleted sites.
        const getDisplayName = function (item) {
            return helper.getSiteContextName(item)
        };

        // The site(s) to be deleted should be in the context site list.
        let siteList;
        if (this.getCommandLineOption("quiet")) {
            siteList = context.siteList;
        } else {
            // Clone the sites so that the items in the context site list are not modified.
            siteList = context.siteList.map(function (site) {
                const siteItem = utils.clone(site);

                // Set the prompt string to indicate that deleting a site will also delete all of its pages.
                siteItem.promptString = i18n.__("cli_delete_site_pages_confirm", {"path": getDisplayName(site)});

                // Return the cloned site to be used for the delete operation.
                return siteItem;
            });
        }

        return this.handleMatchingItems(helper, context, siteList, getDisplayName, siteContext, this.getApiOptions());
    }

    /**
     * Delete a page artifact by id.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} id The id of the artifact to delete.
     */
    deletePageById(helper, context, id) {
        const self = this;
        const sitesHelper = ToolsApi.getSitesHelper();

        // The option validation for delete page by id should result in a single site in the context site list.
        const siteItem = context.siteList[0];

        // Clone the API options and add the siteItem for this operation.
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});

        // Local function for displaying the hierarchicalPath field for deleted pages, and the site context name.
        const getDisplayName = function (item) {
            // Display the hierarchicalPath field for deleted pages, and the site context name.
            return i18n.__("cli_delete_page_in_site",
                {page: item["hierarchicalPath"], site: sitesHelper.getSiteContextName(siteItem)});
        };

        return helper.getRemoteItem(context, id, opts)
            .then(function (item) {
                if (item && !helper.isOverlayPage(context, item, opts)) {
                    // Make sure the page exists and is not an overlay page. Overlay pages should not be deleted.
                    if (self.getCommandLineOption("quiet")) {
                        // The delete will not be prompted, so return the item to be deleted.
                        return item;
                    } else {
                        // The delete will be prompted. Determine whether to use the prompt string that
                        // indicates the child pages will be deleted also.
                        const deferred = Q.defer();

                        // Get the list of child pages for the page to be deleted.
                        helper.listRemoteChildPages(context, item, opts)
                            .then(function (childPages) {
                                if (childPages && childPages.length > 0) {
                                    // There are child pages so set the prompt string to indicate this.
                                    item.promptString = i18n.__("cli_delete_page_children_confirm", {"path": getDisplayName(item)});
                                }
                                deferred.resolve(item);
                            })
                            .catch(function (err) {
                                deferred.reject(err)
                            });

                        return deferred.promise;
                    }
                }
            })
            .then(function (item) {
                const items = item ? [item] : [];
                return self.handleMatchingItems(helper, context, items, getDisplayName, id, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Delete page artifacts by path.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} path The path of the artifact(s) to delete.
     */
    deletePagesByPath(helper, context, path) {
        const self = this;
        const sitesHelper = ToolsApi.getSitesHelper();

        // Use the context site list for getting pages by path.
        const siteItems = context.siteList;
        const pageItems = [];

        // Clone the options so that the siteItem can be modified for each call to getRemoteItemByPath. Also
        // set the "noLogError" option so that if a page doesn't exist in a site it isn't logged as an error.
        const opts = utils.cloneOpts(self.getApiOptions(), {noErrorLog: "true"});

        // Local function for displaying the hierarchicalPath field for deleted pages, and the site context name.
        const getDisplayName = function (item) {
            return i18n.__("cli_delete_page_in_site",
                {page: item["hierarchicalPath"], site: sitesHelper.getSiteContextName(item["siteItem"])});
        };

        // Local function to recursively get pages for one site at a time.
        let index = 0;
        const getPagesBySite = function () {
            if (index < siteItems.length) {
                opts.siteItem = siteItems[index++];
                return helper.getRemoteItemByPath(context, path, opts)
                    .then(function (item) {
                        // Make sure the page exists and is not an overlay page. Overlay pages should not be deleted.
                        if (item && !helper.isOverlayPage(context, item, opts)) {
                            item.siteItem = opts.siteItem;

                            if (self.getCommandLineOption("quiet")) {
                                // The delete will not be prompted, so return the item to be deleted.
                                return item;
                            } else {
                                // The delete will be prompted. Determine whether to use the prompt string that
                                // indicates the child pages will be deleted also.
                                const deferred = Q.defer();

                                // Get the list of child pages for the page to be deleted.
                                helper.listRemoteChildPages(context, item, opts)
                                    .then(function (childPages) {
                                        if (childPages && childPages.length > 0) {
                                            // There are child pages so set the prompt string to indicate this.
                                            item.promptString = i18n.__("cli_delete_page_children_confirm", {"path": getDisplayName(item)});
                                        }
                                        deferred.resolve(item);
                                    })
                                    .catch(function (err) {
                                        deferred.reject(err)
                                    });

                                return deferred.promise;
                            }
                        }
                    })
                    .then(function (item) {
                        // Keep track of the page from each site.
                        if (item) {
                            pageItems.push(item);
                        }

                        // Get the page by path for the next site in the context site list.
                        return getPagesBySite();
                    })
                    .catch(function (err) {
                        if (err.statusCode === 404) {
                            // If the page does not exist for the current site, just ignore the error
                            // and get the page by path for the next site in the context site list.
                            return getPagesBySite();
                        } else {
                            // For any other kind of error, log it (in the API log) and rethrow the error.
                            utils.logErrors(context, "", err);
                            throw err;
                        }
                    });
            } else {
                return Q(pageItems);
            }
        };

        return getPagesBySite()
            .then(function (items) {
                return self.handleMatchingItems(helper, context, items, getDisplayName, path, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Deletes artifacts by id.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} id The id of the artifact to delete.
     */
    deleteById(helper, context, id) {
        const self = this;
        const opts = this.getApiOptions();

        return helper.getRemoteItem(context, id, opts)
            .then(function (item) {
                const getDisplayName = function (item) {
                    // Display the id field for the deleted item.
                    return item["id"];
                };

                return self.handleMatchingItems(helper, context, [item], getDisplayName, id, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Deletes artifacts by path.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} path The path of the artifact to delete.
     */
    deleteByPath(helper, context, path) {
        const self = this;
        const opts = this.getApiOptions();

        return helper.getRemoteItemByPath(context, path, opts)
            .then(function (item) {
                const getDisplayName = function (item) {
                    // Display the path field for deleted layouts and layout mappings.
                    return item["path"];
                };

                return self.handleMatchingItems(helper, context, [item], getDisplayName, path, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Deletes artifacts based on path search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} path The path to delete.
     */
    deleteByPathSearch (helper, context, path) {
        const self = this;
        const opts = this.getApiOptions();

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fl": ["path", "id"]};

        const recursive = this.getCommandLineOption("recursive");

        // Get the specified search results.
        return helper.searchRemote(context, searchOptions, opts, path, recursive)
            .then(function (searchResults) {
                // Display the path field for the deleted item.
                const getDisplayName = function (item) {
                    return item["path"];
                };

                return self.handleMatchingItems(helper, context, searchResults, getDisplayName, path, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Deletes artifacts based on search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} searchField
     * @param {String} searchKey
     */
    deleteBySearch (helper, context, searchField, searchKey ) {
        const self = this;
        const opts = this.getApiOptions();

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fq": [ searchField +":(\"" + searchKey + "\")"]};

        // Get the specified search results.
        return helper.searchRemote(context, searchOptions, opts)
            .then(function (searchResults) {
                // Display the name field for deleted items.
                const getDisplayName = function (item) {
                    return item["name"]
                };

                return self.handleMatchingItems(helper, context, searchResults, getDisplayName, searchKey, opts);
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Deletes (or previews) the matching items.
     *
     * @param {Object} helper The helper for the artifact type to delete.
     * @param {Object} context The API context associated with this delete command.
     * @param {Array} items Array of items to be deleted.
     * @param {Function} getDisplayName The function used to get the name of each item being deleted.
     * @param {String} searchKey The path of the items to be deleted.
     * @param {Object} opts The API options to be used for the delete operation.
     */
    handleMatchingItems(helper, context, items, getDisplayName, searchKey, opts) {
        const self = this;
        const logger = self.getLogger();

        const recursive = this.getCommandLineOption("recursive");

        if (!items || items.length === 0) {
            // --------------------------------------------------------
            // The specified path did not match any existing artifacts.
            // --------------------------------------------------------
            self.warningMessage(i18n.__('cli_delete_no_match'));

            // The warningMessage method does not signify the end of the command, so call successMessage() also.
            self.successMessage(i18n.__('cli_delete_nothing_deleted'));
        } else if (self.getCommandLineOption("preview")) {
            // ------------------------------------------------------------
            // Preview the matching artifacts that would have been deleted.
            // ------------------------------------------------------------
            self.successMessage(i18n.__('cli_delete_preview', {}));
            items.forEach(function (item) {
                if (helper.canDeleteItem(item, false, opts)) {
                    BaseCommand.displayToConsole(getDisplayName(item));
                }
            });
        } else if (!recursive && items.length === 1 && !items[0].promptString) {
            // -------------------------------------------------------------------------
            // Delete the single artifact that was specified via path without prompting.
            // -------------------------------------------------------------------------
            const item = items[0];

            if (!helper.canDeleteItem(item, false, opts)) {
                // The item cannot be deleted, so just return a resolved promise.
                return Q()
                    .then(function () {
                        // Display the localized success message. (Displayed in verbose mode.)
                        self.successMessage(i18n.__('cli_cannot_delete_item', {name: getDisplayName(item)}));
                    });
            }

            logger.info(i18n.__("cli_deleting_artifact", {"name": getDisplayName(item)}));

            // If we're deleting a page, set the siteItem property on the options.
            if (self.getCommandLineOption("pages")) {
                opts = utils.cloneOpts(opts, {siteItem: item.siteItem});
            }

            // Delete the remote item.
            return helper.deleteRemoteItem(context, item, opts)
                .then(function () {
                    self.successMessage(i18n.__('cli_delete_success', {name: getDisplayName(item)}));
                })
                .catch(function (err) {
                    const message = i18n.__("cli_delete_failure", {"name": getDisplayName(item), "err": err.message});
                    logger.error(message);
                    self.errorMessage(message);
                });
        } else if (self.getCommandLineOption("quiet")) {
            // --------------------------------------------
            // Delete matching artifacts without prompting.
            // --------------------------------------------
            logger.info(i18n.__("cli_deleting_artifacts", {"searchkey": searchKey}));
            return self.deleteMatchingItems(helper, context, items, getDisplayName, opts);
        } else {
            // -----------------------------------------
            // Delete matching artifacts with prompting.
            // -----------------------------------------
            logger.info(i18n.__("cli_deleting_artifacts", {"searchkey": searchKey}));

            // Display a prompt for each matching artifact, so the user can decide which ones should be deleted.
            const schemaInput = {};
            items.forEach(function (item) {
                // For each matching file, add a confirmation prompt (keyed by the artifact id).
                schemaInput[item.id] =
                    {
                        description: item.promptString || i18n.__("cli_delete_confirm", {"path": getDisplayName(item)}),
                        required: true
                    };
            });

            // After all the prompts have been displayed, execute each of the confirmed delete operations.
            const deferred = Q.defer();
            const schemaProps = {properties: schemaInput};
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            prompt.get(schemaProps, function (err, result) {
                // Display a blank line to separate the prompt output from the delete output.
                BaseCommand.displayToConsole("");

                // Filter out the items that were not confirmed.
                items = items.filter(function (item) {
                    return (result[item.id] === "y");
                });

                if (items.length > 0) {
                    self.deleteMatchingItems(helper, context, items, getDisplayName, opts)
                        .then(function () {
                            deferred.resolve();
                        })
                        .catch(function (err) {
                            deferred.reject(err);
                        });
                } else {
                    self.successMessage(i18n.__("cli_delete_none_confirmed"));
                    deferred.resolve();
                }
            });

            return deferred.promise;
        }
    }

    /**
     * Deletes the specified item.
     *
     * @param {Object} helper The helper to use for deleting the item.
     * @param {Object} context The API context associated with this delete command.
     * @param {Object} item The item to delete.
     * @param {Function} getDisplayName The function used to get the name of each item being deleted.
     * @param {Object} opts The API options to be used for the delete operation.
     *
     * @returns {Q.Promise<any>} A promise that resolves when the item has been deleted.
     *
     * @private
     */
    _deleteRemoteItem(helper, context, item, getDisplayName, opts) {
        const self = this;
        const logger = self.getLogger();

        if (!helper.canDeleteItem(item, false, opts)) {
            // The item cannot be deleted, so just return a resolved promise.
            return Q()
                .then(function () {
                    // Add an info entry for the localized message. (Displayed in verbose mode.)
                    logger.info(i18n.__('cli_cannot_delete_item', {"name": getDisplayName(item)}));
                });
        }

        // If we're deleting a page, set the siteItem property on the options.
        if (self.getCommandLineOption("pages")) {
            opts = utils.cloneOpts(opts, {siteItem: item.siteItem});
        }

        // Delete the specified item and display a success or failure message.
        return helper.deleteRemoteItem(context, item, opts)
            .then(function (message) {
                // Track the number of successful delete operations.
                self._artifactsCount++;

                // Add a debug entry for the server-generated message. (Not displayed in verbose mode.)
                logger.debug(message);

                // Add an info entry for the localized success message. (Displayed in verbose mode.)
                logger.info(i18n.__('cli_delete_success', {"name": getDisplayName(item)}));
            })
            .catch(function (err) {
                if (err.statusCode === 404) {
                    // The item no longer exists, so assume it was deleted automatically.
                    self._artifactsCount++;

                    // Add an info entry for the localized success message. (Displayed in verbose mode.)
                    logger.info(i18n.__('cli_delete_item_ignored', {"name": getDisplayName(item)}));
                } else {
                    // Track the number of failed delete operations.
                    self._artifactsError++;

                    // Add an error entry for the localized failure message. (Displayed in verbose mode.)
                    logger.error(i18n.__("cli_delete_failure", {"name": getDisplayName(item), "err": err.message}));
                }
            });
    }

    /**
     * Delete the specified items.
     *
     * @param {Object} helper The helper to use for deleting items.
     * @param {Object} context The API context associated with this delete command.
     * @param {Array} items The list of items to be deleted.
     * @param {Function} getDisplayName The function used to get the name of each item being deleted.
     * @param {Object} opts The API options to be used for the delete operations.
     *
     * @returns {Q.Promise} A promise that the specified delete operations have been completed.
     */
    deleteMatchingItems(helper, context, items, getDisplayName, opts) {
        // Throttle the delete operations to the configured concurrency limit.
        const self = this;
        const logger = self.getLogger();

        // Start the spinner (progress indicator) if we're not doing verbose output.
        if (!self.getCommandLineOption("verbose")) {
            self.spinner = self.getProgram().getSpinner();
            self.spinner.start();
        }

        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        return utils.throttledAll(context, items.map(function (item) {
            // For each item, return a function that returns a promise.
            return function () {
                return self._deleteRemoteItem(helper, context, item, getDisplayName, opts);
            }
        }), concurrentLimit)
            .then(function () {
                // Stop the spinner if it's being displayed.
                if (self.spinner) {
                    self.spinner.stop();
                }

                // Construct the message that all delete operations have been completed.
                let message = i18n.__("cli_delete_complete");
                if (self._artifactsCount > 0) {
                    // Include the number of successful delete operations.
                    message += " " + i18n.__n('cli_delete_summary_success', self._artifactsCount);
                }
                if (self._artifactsError > 0) {
                    // Include the number of failed delete operations.
                    message += " " + i18n.__n('cli_delete_summary_errors', self._artifactsError);

                    // Set the exit code for the process, to indicate that some artifacts had push errors.
                    process.exitCode = self.CLI_ERROR_EXIT_CODE;
                }
                if (!self.getCommandLineOption("verbose")) {
                    // Include blurb about looking in the log file for additional information.
                    message += " " + i18n.__('cli_log_non_verbose');
                }

                logger.info(message);
                self.successMessage(message);
            })
            .catch(function (err) {
                if (self.spinner) {
                    self.spinner.stop();
                }

                // Handle the error in the caller.
                throw(err);
            });
    }

    /**
     * Start the display when deleting artifacts by tag.
     */
    startDeleteByTagDisplay () {
        // Display the console message that the delete by tag process is starting.
        BaseCommand.displayToConsole(i18n.__("cli_delete_by_tag_started"));

        // Do not display the spinner in quiet mode, verbose mode, or preview mode.
        if (!this.getCommandLineOption("quiet") && !this.getCommandLineOption("verbose") && !this.getCommandLineOption("preview")) {
            // Start the command line spinner to give the user visual feedback when not displaying verbose output.
            this.spinner = this.getProgram().getSpinner();
            this.spinner.start();
        }

        // Return a resolved promise
        return Q();
    }

    /**
     * Display final information when the delete by tag process has completed.
     */
    endDeleteByTagDisplay () {
        // Turn off the spinner that was started in startDeleteByTagDisplay().
        if (this.spinner) {
            this.spinner.stop();
        }

        // Display the console message that the delete by tag process is complete.
        let message;
        if (this.getCommandLineOption("preview")) {
            message = i18n.__('cli_delete_by_tag_completed');
            this.successMessage(message);
        } else {
            if (this._artifactsCount === 0) {
                // No artifacts were deleted.
                if (this._artifactsError === 0) {
                    // No artifacts were found with the specified tag.
                    message = i18n.__('cli_delete_nothing_deleted');

                    // Display a success message.
                    this.getLogger().info(message);
                    this.successMessage(message);
                } else {
                    // There were only errors.
                    message = i18n.__n('cli_delete_summary_errors', this._artifactsError);

                    if (!this.getCommandLineOption("verbose")) {
                        // Tell the user where to find the log that contains the results.
                        message += " " + i18n.__('cli_log_non_verbose');
                    }

                    // Display the results as an error message.
                    this.getLogger().error(message);
                    this.errorMessage(message);
                }
            } else {
                // Construct a meesage describing the results.
                message = i18n.__('cli_delete_by_tag_completed');

                // Display the number of artifacts deleted successfully.
                message += " " + i18n.__n('cli_delete_summary_success', this._artifactsCount);

                if (this._artifactsError > 0) {
                    // Display the number of errors encountered.
                    message += " " + i18n.__n('cli_delete_summary_errors', this._artifactsError);

                    // Set the exit code for the process, to indicate that some artifacts had delete errors.
                    process.exitCode = this.CLI_ERROR_EXIT_CODE;
                }
                if (!this.getCommandLineOption("verbose")) {
                    // Tell the user where to find the log that contains the results.
                    message += " " + i18n.__('cli_log_non_verbose');
                }

                // Display a success message.
                this.getLogger().info(message);
                this.successMessage(message);
            }
        }
    }

    /**
     * Deletes (or previews) the items with the specified tag.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} tag The tag value to be used for the delete operation.
     */
    deleteByTag (context, tag) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue deleting subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        self.startDeleteByTagDisplay()
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleDeletePromise(self.deleteContentByTag(context, tag), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleDeletePromise(self.deleteTypesByTag(context, tag), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets")) {
                    return self.handleDeletePromise(self.deleteAssetsByTag(context, tag), continueOnError);
                }
            })
            .then(function () {
                self.endDeleteByTagDisplay();
                deferred.resolve();
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Delete content items with a tag that matches the specified tag.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} tag The tag to be used as the search key.
     */
    deleteContentByTag (context, tag) {
        const helper = ToolsApi.getContentHelper();
        const noMatchKey = "cli_delete_content_by_tag_no_match";
        const previewKey = "cli_delete_content_by_tag_preview";
        const messageKey = "cli_delete_content_by_tag";

        return this.handleItemsByTag(helper, context, tag, noMatchKey, previewKey, messageKey, "name");
    }

    /**
     * Delete content items with a tag that matches the specified tag.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} tag The tag to be used as the search key.
     */
    deleteTypesByTag (context, tag) {
        const helper = ToolsApi.getItemTypeHelper();
        const noMatchKey = "cli_delete_types_by_tag_no_match";
        const previewKey = "cli_delete_types_by_tag_preview";
        const messageKey = "cli_delete_types_by_tag";

        return this.handleItemsByTag(helper, context, tag, noMatchKey, previewKey, messageKey, "name");
    }

    /**
     * Delete content assets with a tag that matches the specified tag.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} tag The tag to be used as the search key.
     */
    deleteAssetsByTag (context, tag) {
        const helper = ToolsApi.getAssetsHelper();
        const noMatchKey = "cli_delete_assets_by_tag_no_match";
        const previewKey = "cli_delete_assets_by_tag_preview";
        const messageKey = "cli_delete_assets_by_tag";

        return this.handleItemsByTag(helper, context, tag, noMatchKey, previewKey, messageKey, "path");
    }

    /**
     * Deletes artifacts based on search results.
     *
     * @param {Object} helper The helper for the artifact type.
     * @param {Object} context The API context associated with this delete command.
     * @param {String} tag The tag to be used as the search key.
     * @param {String} noMatchKey The message key to use when no matching items are found.
     * @param {String} previewKey The message key to use when previewing.
     * @param {String} messageKey The message key to use when deleting.
     * @param {String} displayField The item field to be displayed.
     */
    handleItemsByTag (helper, context, tag, noMatchKey, previewKey, messageKey, displayField) {
        const self = this;

        // For each artifact returned, we only need the path and ID values.
        const searchOptions = {"fq": ["tags:(\"" + tag + "\")"]};

        // Get the specified search results.
        const opts = this.getApiOptions();
        return helper.searchRemote(context, searchOptions, opts)
            .then(function (items) {
                const logger = self.getLogger();

                if (!items || items.length === 0) {
                    // --------------------------------------------------------
                    // The specified path did not match any existing artifacts.
                    // --------------------------------------------------------
                    BaseCommand.displayToConsole(i18n.__(noMatchKey, {"tag": tag}));
                } else if (self.getCommandLineOption("preview")) {
                    // ------------------------------------------------------------
                    // Preview the matching artifacts that would have been deleted.
                    // ------------------------------------------------------------
                    BaseCommand.displayToConsole(PREFIX + i18n.__(previewKey, {"tag": tag}) + SUFFIX);
                    items.forEach(function (item) {
                        if (helper.canDeleteItem(item, false, opts)) {
                            BaseCommand.displayToConsole(item[displayField]);
                        }
                    });
                } else if (self.getCommandLineOption("quiet")) {
                    // --------------------------------------------
                    // Delete matching artifacts without prompting.
                    // --------------------------------------------
                    logger.info(PREFIX + i18n.__(messageKey, {"tag": tag}) + SUFFIX);
                    return self.deleteItemsByTag(helper, context, items, displayField, opts);
                } else {
                    // -----------------------------------------
                    // Delete matching artifacts with prompting.
                    // -----------------------------------------
                    logger.info(PREFIX + i18n.__(messageKey, {"tag": tag}) + SUFFIX);

                    // Display a prompt for each matching artifact, so the user can decide which ones should be deleted.
                    const schemaInput = {};
                    items.forEach(function (item) {
                        // For each matching file, add a confirmation prompt (keyed by the artifact id).
                        schemaInput[item.id] =
                            {
                                description: i18n.__("cli_delete_confirm", {"path": item[displayField]}),
                                required: true
                            };
                    });

                    // After all the prompts have been displayed, execute each of the confirmed delete operations.
                    const deferred = Q.defer();
                    const schemaProps = {properties: schemaInput};
                    prompt.message = '';
                    prompt.delimiter = ' ';
                    prompt.start();
                    prompt.get(schemaProps, function (err, result) {
                        // Display a blank line to separate the prompt output from the delete output.
                        BaseCommand.displayToConsole("");

                        // Filter out the items that were not confirmed.
                        items = items.filter(function (item) {
                            return (result[item.id] === "y");
                        });

                        if (items.length > 0) {
                            self.deleteItemsByTag(helper, context, items, displayField, opts)
                                .then(function () {
                                    deferred.resolve();
                                })
                                .catch(function (err) {
                                    deferred.reject(err);
                                });
                        } else {
                            BaseCommand.displayToConsole(i18n.__("cli_delete_none_confirmed"));
                            deferred.resolve();
                        }
                    });

                    return deferred.promise;
                }
            })
            .catch(function (err) {
                // Consider this to be a failed delete operation.
                self._artifactsError++;

                throw err;
            });
    }

    /**
     * Delete the specified items.
     *
     * @param {Object} helper The helper to use for deleting items.
     * @param {Object} context The API context associated with this delete command.
     * @param {Array} items The list of items to be deleted.
     * @param {String} displayField The item field to be displayed.
     * @param {Object} opts The API options to be used for the delete operations.
     *
     * @returns {Q.Promise} A promise that the specified delete operations have been completed.
     */
    deleteItemsByTag (helper, context, items, displayField, opts) {
        // Throttle the delete operations to the configured concurrency limit.
        const self = this;
        const logger = self.getLogger();

        const concurrentLimit = options.getRelevantOption(context, opts, "concurrent-limit", helper.getArtifactName());
        return utils.throttledAll(context, items.map(function (item) {
            // For each item, return a function that returns a promise.
            return function () {
                // Delete the specified item and display a success or failure message.
                return helper.deleteRemoteItem(context, item, opts)
                    .then(function (message) {
                        // Track the number of successful delete operations.
                        self._artifactsCount++;

                        // Add a debug entry for the server-generated message. (Not displayed in verbose mode.)
                        logger.debug(message);

                        // Add an info entry for the localized success message. (Displayed in verbose mode.)
                        logger.info(i18n.__('cli_delete_success', {"name": item[displayField]}));
                    })
                    .catch(function (err) {
                        // Track the number of failed delete operations.
                        self._artifactsError++;

                        // Add an error entry for the localized failure message. (Displayed in verbose mode.)
                        logger.error(i18n.__("cli_delete_failure", {"name": item[displayField], "err": err.message}));
                    });
            }
        }), concurrentLimit);
    }

    /**
     * Start the display when deleting artifacts by manifest.
     */
    startDeleteByManifestDisplay () {
        const deferred = Q.defer();

        // Display the console message that the delete by manifest process is starting.
        const preview = this.getCommandLineOption("preview");
        const messageKey = preview ? "cli_preview_delete_manifest_started" : "cli_delete_manifest_started";
        BaseCommand.displayToConsole(i18n.__(messageKey, {name: this.getCommandLineOption("manifest")}));

        // Start the command line spinner to give the user visual feedback, except when displaying verbose output or previewing.
        if (!this.getCommandLineOption("verbose") && !preview) {
            this.spinner = this.getProgram().getSpinner();
            this.spinner.start();
        }

        deferred.resolve();
        return deferred.promise;
    }

    /**
     * Display final information when the delete by manifest process has completed.
     */
    endDeleteByManifestDisplay () {
        // Turn off the spinner that was started in startDeleteAllDisplay().
        if (this.spinner) {
            this.spinner.stop();
        }

        if (this.getCommandLineOption("preview")) {
            // Display a success message.
            const message = i18n.__('cli_preview_delete_manifest_completed', {name: this.getCommandLineOption("manifest")});
            this.getLogger().info(message);
            this.successMessage(message);
        }
        else if (this._artifactsCount === 0) {
            // No artifacts were deleted -- only errors.
            let message = i18n.__n('cli_delete_summary_errors', this._artifactsError);

            if (!this.getCommandLineOption("verbose")) {
                // Tell the user where to find the log that contains the results.
                message += " " + i18n.__('cli_log_non_verbose');
            }

            // Display the results as an error message.
            this.getLogger().error(message);
            this.errorMessage(message);
        } else {
            // Construct a message describing the results.
            let message = i18n.__('cli_delete_manifest_completed', {name: this.getCommandLineOption("manifest")});

            // Display the number of artifacts deleted successfully.
            message += " " + i18n.__n('cli_delete_summary_success', this._artifactsCount);

            if (this._artifactsError > 0) {
                // Display the number of errors encountered.
                message += " " + i18n.__n('cli_delete_summary_errors', this._artifactsError);

                // Set the exit code for the process, to indicate that some artifacts had delete errors.
                process.exitCode = this.CLI_ERROR_EXIT_CODE;
            }
            if (!this.getCommandLineOption("verbose")) {
                // Tell the user where to find the log that contains the results.
                message += " " + i18n.__('cli_log_non_verbose');
            }

            // Display a success message.
            this.getLogger().info(message);
            this.successMessage(message);
        }
    }

    /**
     * Delete the artifacts specified in the current manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @return {Q.Promise} A promise to delete all artifacts specified in the current manifest.
     */
    deleteByManifest (context) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue deleting subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        let deferDeleteManifestPath;

        self.startDeleteByManifestDisplay()
            .then(function () {
                if (self.getCommandLineOption("pages")) {
                    // Get the list of site items to use for deleting pages.
                    const siteItems = context.siteList;

                    // Local function to recursively delete pages for one site at a time.
                    let index = 0;
                    const deletePagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handleDeletePromise(self.deleteManifestPages(context, siteItems[index++]), continueOnError)
                                .then(function () {
                                    // Delete pages for the next site after the previous site is complete.
                                    return deletePagesBySite(context);
                                });
                        }
                    };

                    return deletePagesBySite(context);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites")) {
                    return self.handleDeletePromise(self.deleteManifestSites(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleDeletePromise(self.deleteManifestContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("defaultContent")) {
                    return self.handleDeletePromise(self.deleteManifestDefaultContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layoutMappings")) {
                    return self.handleDeletePromise(self.deleteManifestLayoutMappings(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleDeletePromise(self.deleteManifestTypes(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layouts")) {
                    return self.handleDeletePromise(self.deleteManifestLayouts(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handleDeletePromise(self.deleteManifestCategories(context), continueOnError);
                }
            })
            .then(function () {
                // If we're using a server manifest and it references itself, we want to delete it last.
                if (context.serverManifest) {
                    const manifestPath = manifests.getManifestPath(context, context.readManifestFile, self.getApiOptions());
                    if (context.readManifest.assets[manifestPath]) {
                        delete context.readManifest.assets[manifestPath];
                        deferDeleteManifestPath = manifestPath;
                    }
                }
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handleDeletePromise(self.deleteManifestAssets(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handleDeletePromise(self.deleteManifestImageProfiles(context), continueOnError);
                }
            })
            .then(function () {
                // Now, delete the server manifest if it referenced itself.
                if (deferDeleteManifestPath && self._artifactsError === 0) {
                    if (self.getCommandLineOption("preview")) {
                        BaseCommand.displayToConsole("    " + deferDeleteManifestPath);
                    } else {
                        const helper = ToolsApi.getAssetsHelper();
                        const manifestAsset = {path: deferDeleteManifestPath};
                        const opts = self.getApiOptions();

                        // Display the path field for deleted manifest asset.
                        const getDisplayName = function () {
                            return deferDeleteManifestPath;
                        };

                        return self._deleteRemoteItem(helper, context, manifestAsset, getDisplayName, opts);
                    }
                }
            })
            .then(function () {
                self.endDeleteByManifestDisplay();
                deferred.resolve();
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Delete the asset artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the asset artifacts are deleted.
     */
    deleteManifestAssets (context) {
        const helper = ToolsApi.getAssetsHelper();

        // The manifest can have both types of assets in the assets section, filter based on the command line options.
        const webassets = this.getCommandLineOption("webassets");
        const assets = this.getCommandLineOption("assets");
        if (webassets && assets) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
        } else if (webassets) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
        } else if (assets) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
        }

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_assets");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_assets");
            } else { /* key === DISPLAY_NAME */
                // Display the path field for the deleted asset.
                return item["path"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the image profile artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the image profile artifacts are deleted.
     */
    deleteManifestImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_image_profiles");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_image_profiles");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted image profile.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the layout artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the layout artifacts are deleted.
     */
    deleteManifestLayouts (context) {
        const helper = ToolsApi.getLayoutsHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_layouts");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_layouts");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted layout.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the layout mapping artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the layout mappings artifacts are deleted.
     */
    deleteManifestLayoutMappings (context) {
        const helper = ToolsApi.getLayoutMappingsHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_layout_mappings");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_layout_mappings");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted layout mapping.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the category artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the category artifacts are deleted.
     */
    deleteManifestCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_categories");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_categories");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted category.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the type artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the type artifacts are deleted.
     */
    deleteManifestTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_types");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_types");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted content type.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the content artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the content artifacts are deleted.
     */
    deleteManifestContent (context) {
        const helper = ToolsApi.getContentHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_content");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_content");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted content item.
                return item["name"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the default-content artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the default-content artifacts are deleted.
     */
    deleteManifestDefaultContent (context) {
        const helper = ToolsApi.getDefaultContentHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_default_content");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_default_content");
            } else { /* key === DISPLAY_NAME */
                // Display the name field for the deleted content item.
                return item["name"];
            }
        }; 
        
        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the site artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when the site artifacts are deleted.
     */
    deleteManifestSites(context) {
        const helper = ToolsApi.getSitesHelper();

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_sites");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_sites");
            } else { /* key === DISPLAY_NAME */
                // Display the context name for the deleted site.
                return helper.getSiteContextName(item);
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, this.getApiOptions());
    }

    /**
     * Delete the page artifacts in the manifest.
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} siteItem The site containing the pages being deleted.
     *
     * @returns {Q.Promise} A promise that is resolved when the page artifacts are deleted.
     */
    deleteManifestPages(context, siteItem) {
        const helper = ToolsApi.getPagesHelper();
        const sitesHelper = ToolsApi.getSitesHelper();
        const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});

        // Local function to supply display strings for the delete operation.
        const getDisplayString = function (key, item) {
            if (key === DISPLAY_PREVIEW_BANNER) {
                return i18n.__("cli_preview_deleting_manifest_pages");
            } else if (key === DISPLAY_DELETE_BANNER) {
                return i18n.__("cli_deleting_manifest_pages_for_site", {id: sitesHelper.getSiteContextName(siteItem)});
            } else { /* key === DISPLAY_NAME */
                // Display the path field for the deleted page.
                return item["path"];
            }
        };

        return this.deleteManifestItems(context, helper, getDisplayString, opts);
    }

    deleteManifestItems(context, helper, getDisplayString, opts) {
        const self = this;
        const logger = self.getLogger();

        if (self.getCommandLineOption("preview")) {
            BaseCommand.displayToConsole(getDisplayString(DISPLAY_PREVIEW_BANNER));
            return helper.getManifestItems(context, opts)
                .then(function (items) {
                    items.forEach(function (item) {
                        if (helper.canDeleteItem(item, false, opts)) {
                            BaseCommand.displayToConsole("    " + getDisplayString(DISPLAY_NAME, item));
                        }
                    });
            });
        } else {
            const emitter = context.eventEmitter;

            // Add a banner for the type of artifacts being deleted.
            logger.info(PREFIX + getDisplayString(DISPLAY_DELETE_BANNER) + SUFFIX);

            // The api emits an event when an item is deleted, so we log it for the user.
            const itemDeleted = function (item) {
                self._artifactsCount++;
                logger.info(i18n.__("cli_delete_manifest_item_success", {name: getDisplayString(DISPLAY_NAME, item)}));
            };
            emitter.on("deleted", itemDeleted);

            // The api emits an event when an item to be deleted cannot be found, so we log it for the user.
            const itemDeletedIgnored = function (item) {
                self._artifactsCount++;
                logger.info(i18n.__("cli_delete_item_ignored", {name: getDisplayString(DISPLAY_NAME, item)}));
            };
            emitter.on("deleted-ignored", itemDeletedIgnored);

            // The api emits an event when there is a delete error, so we log it for the user.
            const itemDeletedError = function (error, item) {
                self._artifactsError++;
                logger.error(i18n.__("cli_delete_manifest_item_failure", {
                    name: getDisplayString(DISPLAY_NAME, item),
                    err: error.message
                }));
            };
            emitter.on("deleted-error", itemDeletedError);

            return helper.deleteManifestItems(context, opts)
                .catch(function (err) {
                    // If the promise is rejected, it means that an error was encountered before the delete process started,
                    // so we need to make sure this error is accounted for.
                    self._artifactsError++;
                    throw err;
                })
                .finally(function () {
                    emitter.removeListener("deleted", itemDeleted);
                    emitter.removeListener("deleted-ignored", itemDeletedIgnored);
                    emitter.removeListener("deleted-error", itemDeletedError);
                });
        }
    }

    /**
     * Start the display when deleting all artifacts.
     */
    startDeleteAllDisplay () {
        const deferred = Q.defer();

        const self = this;
        if (this.getCommandLineOption("quiet")) {
            // Display the console message that the delete all process is starting.
            BaseCommand.displayToConsole(i18n.__("cli_delete_all_started"));

            // Quiet mode, so don't prompt or display the spinner.
            deferred.resolve();
        } else {
            // Prompt for confirmation.
            const schemaInput =
            {
                confirm:
                {
                    description: i18n.__("cli_delete_confirm_all"),
                    required: true
                }
            };
            const schemaProps = {properties: schemaInput};
            prompt.message = '';
            prompt.delimiter = ' ';
            prompt.start();
            prompt.get(schemaProps, function (err, result) {
                if (result["confirm"] === "y"){
                    // Display the console message that the delete all process is starting.
                    BaseCommand.displayToConsole(i18n.__("cli_delete_all_started"));

                    // Start the command line spinner to give the user visual feedback when not displaying verbose output.
                    if (!self.getCommandLineOption("verbose")) {
                        self.spinner = self.getProgram().getSpinner();
                        self.spinner.start();
                    }

                    deferred.resolve();
                } else {
                    const error = new Error(i18n.__("cli_delete_confirm_no"));

                    // This error should not be logged, since the command was cancelled before it started.
                    error["noLog"] = true;

                    deferred.reject(error);
                }
            });
        }

        return deferred.promise;
    }

    /**
     * Display final information when the delete all process has completed.
     */
    endDeleteAllDisplay () {
        // Turn off the spinner that was started in startDeleteAllDisplay().
        if (this.spinner) {
            this.spinner.stop();
        }

        let message;
        if (this._artifactsCount === 0) {
            // No artifacts were deleted.
            if (this._artifactsError === 0) {
                // No artifacts were found with the specified tag.
                message = i18n.__('cli_delete_nothing_deleted');

                // Display a success message.
                this.getLogger().info(message);
                this.successMessage(message);
            } else {
                // There were only errors.
                message = i18n.__n('cli_delete_summary_errors', this._artifactsError);

                if (!this.getCommandLineOption("verbose")) {
                    // Tell the user where to find the log that contains the results.
                    message += " " + i18n.__('cli_log_non_verbose');
                }

                // Display the results as an error message.
                this.getLogger().error(message);
                this.errorMessage(message);
            }
        } else {
            // Construct a meesage describing the results.
            message = i18n.__('cli_delete_all_completed');

            // Display the number of artifacts deleted successfully.
            message += " " + i18n.__n('cli_delete_summary_success', this._artifactsCount);

            if (this._artifactsError > 0) {
                // Display the number of errors encountered.
                message += " " + i18n.__n('cli_delete_summary_errors', this._artifactsError);

                // Set the exit code for the process, to indicate that some artifacts had delete errors.
                process.exitCode = this.CLI_ERROR_EXIT_CODE;
            }
            if (!this.getCommandLineOption("verbose")) {
                // Tell the user where to find the log that contains the results.
                message += " " + i18n.__('cli_log_non_verbose');
            }

            // Display a success message.
            this.getLogger().info(message);
            this.successMessage(message);
        }
    }

    /**
     * Delete all artifacts of the specified type(s).
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @return {Q.Promise} A promise to delete all artifacts of the specified type(s).
     */
    deleteAll (context) {
        const deferred = Q.defer();
        const self = this;

        // Determine whether to continue deleting subsequent artifact types on error.
        const continueOnError = options.getProperty(context, "continueOnError");

        self.startDeleteAllDisplay()
            .then(function () {
                if (self.getCommandLineOption("pages")) {
                    // Get the list of site items to use for deleting pages.
                    const siteItems = context.siteList;

                    // Local function to recursively delete pages for one site at a time.
                    let index = 0;
                    const deletePagesBySite = function (context) {
                        if (index < siteItems.length) {
                            return self.handleDeletePromise(self.deleteAllPages(context, siteItems[index++]), continueOnError)
                                .then(function () {
                                    // Delete pages for the next site after the previous site is complete.
                                    return deletePagesBySite(context);
                                });
                        }
                    };

                    return deletePagesBySite(context);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("sites")) {
                    return self.handleDeletePromise(self.deleteAllSites(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("content")) {
                    return self.handleDeletePromise(self.deleteAllContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("defaultContent")) {
                    return self.handleDeletePromise(self.deleteAllDefaultContent(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layoutMappings")) {
                    return self.handleDeletePromise(self.deleteAllLayoutMappings(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("types")) {
                    return self.handleDeletePromise(self.deleteAllTypes(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("layouts")) {
                    return self.handleDeletePromise(self.deleteAllLayouts(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("categories")) {
                    return self.handleDeletePromise(self.deleteAllCategories(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("assets") || self.getCommandLineOption("webassets")) {
                    return self.handleDeletePromise(self.deleteAllAssets(context), continueOnError);
                }
            })
            .then(function () {
                if (self.getCommandLineOption("imageProfiles")) {
                    return self.handleDeletePromise(self.deleteAllImageProfiles(context), continueOnError);
                }
            })
            .then(function () {
                self.handleRenditions(context);
            })
            .then(function () {
                self.endDeleteAllDisplay();
                deferred.resolve();
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Handle the given delete promise according to whether errors should be returned to the caller.
     *
     * @param {Q.Promise} promise A promise to delete artifacts of a single type.
     * @param {boolean} continueOnError Flag specifying whether to continue deleting subsequent artifact types on error.
     *
     * @returns {Q.Promise} A promise that is resolved when the delete has completed.
     */
    handleDeletePromise (promise, continueOnError) {
        const self = this;
        if (continueOnError) {
            // Create a nested promise. Any error thrown by this promise will be logged, but not returned to the caller.
            const deferredDelete = Q.defer();
            promise
                .then(function () {
                    deferredDelete.resolve();
                })
                .catch(function (err) {
                    const logger = self.getLogger();
                    logger.error(err.message);
                    deferredDelete.resolve();
                });
            return deferredDelete.promise;
        } else {
            // Any error thrown by this promise will be returned to the caller.
            return promise;
        }
    }

    /**
     * Delete all "Asset" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all asset artifacts are deleted.
     */
    deleteAllAssets (context) {
        const helper = ToolsApi.getAssetsHelper();
        const webassets = this.getCommandLineOption("webassets");
        const assets = this.getCommandLineOption("assets");
        const both = webassets && assets;
        let messageKey;

        if (both) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_BOTH);
            messageKey = "cli_deleting_all_assets";
        } else if (assets) {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_CONTENT_ASSETS);
            messageKey = "cli_deleting_all_content_assets";
        } else {
            this.setApiOption(helper.ASSET_TYPES, helper.ASSET_TYPES_WEB_ASSETS);
            messageKey = "cli_deleting_all_web_assets";
        }

        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__(messageKey) + SUFFIX);

        // Display the path field for deleted assets.
        const getDisplayName = function (item) {
            return item["path"]
        };

        return this.deleteAllItems(context, helper, getDisplayName, opts);
    }

    /**
     * Delete all "Image Profile" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all image profile artifacts are deleted.
     */
    deleteAllImageProfiles (context) {
        const helper = ToolsApi.getImageProfilesHelper();
        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__("cli_deleting_all_image_profiles") + SUFFIX);

        // Display the name field for deleted image profiles.
        const getDisplayName = function (item) {
            return item["name"]
        };

        return this.deleteAllItems(context, helper, getDisplayName, opts);
    }

    /**
     * Delete all "Layout" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all layout artifacts are deleted.
     */
    deleteAllLayouts (context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Layouts are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getLayoutsHelper();
            const opts = this.getApiOptions();
            const logger = this.getLogger();

            // Add a banner for the type of artifacts being deleted.
            logger.info(PREFIX + i18n.__("cli_deleting_all_layouts") + SUFFIX);

            // Display the name field for deleted layouts.
            const getDisplayName = function (item) {
                return item["name"]
            };

            return this.deleteAllItems(context, helper, getDisplayName, opts);
        }
    }

    /**
     * Delete all "Layout Mapping" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all layout mappings artifacts are deleted.
     */
    deleteAllLayoutMappings (context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Layout Mappings are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getLayoutMappingsHelper();
            const opts = this.getApiOptions();
            const logger = this.getLogger();

            // Add a banner for the type of artifacts being deleted.
            logger.info(PREFIX + i18n.__("cli_deleting_all_layout_mappings") + SUFFIX);

            // Display the name field for deleted layout mappings.
            const getDisplayName = function (item) {
                return item["name"]
            };

            return this.deleteAllItems(context, helper, getDisplayName, opts);
        }
    }

    /**
     * Delete all "Category" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all category artifacts are deleted.
     */
    deleteAllCategories (context) {
        const helper = ToolsApi.getCategoriesHelper();
        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__("cli_deleting_all_categories") + SUFFIX);

        // Display the name field for deleted categories.
        const getDisplayName = function (item) {
            return item["name"]
        };

        return this.deleteAllItems(context, helper, getDisplayName, opts);
    }

    /**
     * Delete all "Type" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all type artifacts are deleted.
     */
    deleteAllTypes (context) {
        const helper = ToolsApi.getItemTypeHelper();
        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__("cli_delete_all_types") + SUFFIX);

        // Display the name field for deleted content types.
        const getDisplayName = function (item) {
            return item["name"]
        };

        return this.deleteAllItems(context, helper, getDisplayName, opts);
    }


    /**
     * Delete all "default-content" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all default-content artifacts are deleted.
     */
    deleteAllDefaultContent (context) {
        const helper = ToolsApi.getDefaultContentHelper();
        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__("cli_deleting_all_default_content") + SUFFIX);

        return this.deleteAllItems(context, helper, "name", opts);
    }

    /**
     * Delete all "Content" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all content artifacts are deleted.
     */
    deleteAllContent (context) {
        const helper = ToolsApi.getContentHelper();
        const opts = this.getApiOptions();
        const logger = this.getLogger();

        // Add a banner for the type of artifacts being deleted.
        logger.info(PREFIX + i18n.__("cli_deleting_all_content") + SUFFIX);

        // Display the name field for deleted content items.
        const getDisplayName = function (item) {
            return item["name"]
        };

        return this.deleteAllItems(context, helper, getDisplayName, opts);
    }

    /**
     * Delete all "Site" artifacts.
     *
     * @param {Object} context The API context associated with this delete command.
     *
     * @returns {Q.Promise} A promise that is resolved when all site artifacts are deleted.
     */
    deleteAllSites(context) {
        if (options.getProperty(context, "tier") === "Base") {
            // Sites are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getSitesHelper();
            const opts = this.getApiOptions();
            const logger = this.getLogger();

            // Add a banner for the type of artifacts being deleted.
            logger.info(PREFIX + i18n.__("cli_deleting_all_sites") + SUFFIX);

            // Display the context name for deleted sites.
            const getDisplayName = function (item) {
                return helper.getSiteContextName(item)
            };

            return this.deleteAllItems(context, helper, getDisplayName, opts);
        }
    }

    /**
     * Delete all "Page" artifacts for a specified site
     *
     * @param {Object} context The API context associated with this delete command.
     * @param {String} siteItem The site containing the pages being deleted.
     *
     * @returns {Q.Promise} A promise that is resolved when all page artifacts are deleted.
     */
    deleteAllPages(context, siteItem) {
        if (options.getProperty(context, "tier") === "Base") {
            // Pages are not available in a Base tenant, so just return a resolved promise.
            return Q.resolve();
        } else {
            const helper = ToolsApi.getPagesHelper();
            const opts = utils.cloneOpts(this.getApiOptions(), {siteItem: siteItem});
            const logger = this.getLogger();

            // Add a banner for the type of artifacts being deleted.
            const contextName = ToolsApi.getSitesHelper().getSiteContextName(siteItem);
            logger.info(PREFIX + i18n.__("cli_deleting_all_pages_for_site", {id: contextName}) + SUFFIX);

            // Display the hierarchicalPath field for deleted pages.
            const getDisplayName = function (item) {
                return item["hierarchicalPath"]
            };

            return this.deleteAllItems(context, helper, getDisplayName, opts);
        }
    }

    deleteAllItems(context, helper, getDisplayName, opts) {
        const self = this;
        const logger = self.getLogger();
        const emitter = context.eventEmitter;

        // The api emits an event when an item is deleted, so we log it for the user.
        const itemDeleted = function (item) {
            self._artifactsCount++;
            logger.info(i18n.__("cli_delete_all_item_success", {name: getDisplayName(item)}));
        };
        emitter.on("deleted", itemDeleted);

        // The api emits an event when an item to be deleted cannot be found, so we log it for the user.
        const itemDeletedIgnored = function (item) {
            self._artifactsCount++;
            logger.info(i18n.__("cli_delete_item_ignored", {name: getDisplayName(item)}));
        };
        emitter.on("deleted-ignored", itemDeletedIgnored);

        // The api emits an event when there is a delete error, so we log it for the user.
        const itemDeletedError = function (error, item) {
            self._artifactsError++;
            logger.error(i18n.__("cli_delete_all_item_failure", {name: getDisplayName(item), err: error.message}));
        };
        emitter.on("deleted-error", itemDeletedError);

        return helper.deleteRemoteItems(context, opts)
            .catch(function (err) {
                // If the promise is rejected, it means that an error was encountered before the delete process started,
                // so we need to make sure this error is accounted for.
                self._artifactsError++;
                throw err;
            })
            .finally(function () {
                emitter.removeListener("deleted", itemDeleted);
                emitter.removeListener("deleted-ignored", itemDeletedIgnored);
                emitter.removeListener("deleted-error", itemDeletedError);
            });
    }

    /**
     *
     * @param context
     */
    handleRenditions (context) {
        const deferred = Q.defer();

        // Check to see if there are any remaining renditions.
        const helper = ToolsApi.getRenditionsHelper();
        const opts = utils.cloneOpts(this.getApiOptions(), {limit: 1});
        helper.getRemoteItems(context, opts)
            .then(function (items) {
                if (!items || items.length === 0) {
                    // There are no remaining renditions, so remove the hashes.
                    helper.removeAllHashes(context, opts);
                }
            })
            .finally(function () {
                // Resolve the promise whether getRemoteItems() succeeded or failed.
                deferred.resolve();
            });

        return deferred.promise;
    }

    /**
     * Create a site list to be used for this command, based on the given lists of ready and draft sites.
     *
     * @param {Array} readySites The list of ready sites to be used for this command.
     * @param {Array} draftSites The list of draft sites to be used for this command.
     *
     * @return {Array} A site list to be used for this command.
     *
     * @override
     */
    createSiteList(readySites, draftSites) {
        // For delete, handle the draft sites before the ready sites. With this ordering, draft pages will be deleted
        // before ready pages. (A ready page cannot be deleted if there is a draft page that refers to it.)
        return draftSites.concat(readySites);
    }

    /**
     * Reset the command line options for this command.
     *
     * NOTE: This is used to reset the values when the command is invoked by the mocha testing. Normally the Commander
     * process ends after the command is executed and so these values go away. But when running the tests, the process
     * isn't terminated and these values need to be reset.
     */
    resetCommandLineOptions () {
        this.setCommandLineOption("webassets", undefined);
        this.setCommandLineOption("assets", undefined);
        this.setCommandLineOption("layouts",  undefined);
        this.setCommandLineOption("layoutMappings", undefined);
        this.setCommandLineOption("content", undefined);
        this.setCommandLineOption("defaultContent", undefined);
        this.setCommandLineOption("imageProfiles", undefined);
        this.setCommandLineOption("types", undefined);
        this.setCommandLineOption("categories", undefined);
        this.setCommandLineOption("pages", undefined);
        this.setCommandLineOption("sites", undefined);
        this.setCommandLineOption("all", undefined);
        this.setCommandLineOption("id", undefined);
        this.setCommandLineOption("byTypeName", undefined);
        this.setCommandLineOption("named", undefined);
        this.setCommandLineOption("path", undefined);
        this.setCommandLineOption("tag", undefined);
        this.setCommandLineOption("recursive", undefined);
        this.setCommandLineOption("preview", undefined);
        this.setCommandLineOption("quiet", undefined);
        this.setCommandLineOption("pageContent", undefined);
        this.setCommandLineOption("allAuthoring", undefined);
        this.setCommandLineOption("manifest", undefined);
        this.setCommandLineOption("serverManifest", undefined);

        super.resetCommandLineOptions();
    }
}

function deleteCommand (program) {
    program
        .command('delete')
        .description(i18n.__('cli_delete_description'))
        .option('-a --assets',           i18n.__('cli_delete_opt_assets'))
        .option('-w --webassets',        i18n.__('cli_delete_opt_web_assets'))
        .option('-l --layouts',          i18n.__('cli_delete_opt_layouts'))
        .option('-m --layout-mappings',  i18n.__('cli_delete_opt_layout_mappings'))
        .option('-c --content',          i18n.__('cli_delete_opt_content'))
        .option('-D --default-content',  i18n.__('cli_delete_opt_default_content'))
        .option('-t --types',            i18n.__('cli_delete_opt_types'))
        .option('-i --image-profiles',   i18n.__('cli_delete_opt_image_profiles'))
        .option('-C --categories',       i18n.__('cli_delete_opt_categories'))
        .option('-s --sites', i18n.__('cli_delete_opt_sites'))
        .option('-p --pages',            i18n.__('cli_delete_opt_pages'))
        .option('--page-content',        i18n.__('cli_delete_opt_page_content'))
        .option('-A --all-authoring',    i18n.__('cli_delete_opt_all_authoring'))
        .option('--all',                 i18n.__('cli_delete_opt_all_artifacts'))
        .option('--id <id>',             i18n.__('cli_delete_opt_id'))
        .option('--path <path>',         i18n.__('cli_delete_opt_path'))
        .option('-n --named <name>',     i18n.__('cli_delete_opt_name'))
        .option('-T --tag <tag>',        i18n.__('cli_delete_opt_tag'))
        .option('--by-type-name <name>', i18n.__('cli_delete_opt_by_type_name'))
        .option('-r --recursive',        i18n.__('cli_delete_opt_recursive'))
        .option('-P --preview',          i18n.__('cli_delete_opt_preview'))
        .option('-q --quiet',            i18n.__('cli_delete_opt_quiet'))
        .option('-v --verbose',          i18n.__('cli_opt_verbose'))
        .option('--manifest <manifest>', i18n.__('cli_delete_opt_use_manifest'))
        .option('--server-manifest <manifest>', i18n.__('cli_delete_opt_use_server_manifest'))
        .option('--ready', i18n.__('cli_delete_opt_ready'))
        .option('--draft', i18n.__('cli_delete_opt_draft'))
        .option('--site-context <contextRoot>', i18n.__('cli_list_opt_siteContext'))
        .option('--dir <dir>',           i18n.__('cli_delete_opt_dir', {"product_name": utils.ProductName}))
        .option('--user <user>',         i18n.__('cli_opt_user_name'))
        .option('--password <password>', i18n.__('cli_opt_password'))
        .option('--url <url>',           i18n.__('cli_opt_url', {"product_name": utils.ProductName}))
        .action(function (commandLineOptions) {
            const command = new DeleteCommand(program);
            if (command.setCommandLineOptions(commandLineOptions, this)) {
                command.doDelete();
            }
        });
}

module.exports = deleteCommand;
