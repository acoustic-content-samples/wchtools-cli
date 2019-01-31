# Changelog

### 4.1.20 changes since 4.1.15
  - Fix a bug with pulling assets with certain special characters in the filename when using the --path option.

### 4.1.15 changes since 4.1.12
  - Fix a bug that causes resources to be pulled unnecessarily when using the --path option.

### 4.1.12 changes since 4.1.5
  - Fix a bug that prevents iterating through all resources.
  - Fix a bug that prevents iterating through all search results when using the search API.
  - Fix a bug in resource filtering of robots.txt and sitemap.xml.
  - Logging configuration improvements.
  - Disable log colors when not in a TTY process.
  - Improve performance of --path option.
  - Use deep page mode for content paging.
  - Use next links for resource paging.

### 4.1.5 changes since 4.1
  - Fix resource filtering to avoid pulling resources for assets that were skipped.

### 4.1 changes since 4.0
  - Add support for pulling, pushing, deleting, comparing and listing default-content artifacts

### 4.0 changes since 3.2
  - Add support for storing user credentials in the operating system key manager (Windows and Mac OS only).
  - Increase the number and size of retained logs
  - Increment minimum Node.js version to 8.x.

### 3.2 changes since 3.1

  - Add full support for push, pull, list, delete, and compare of multiple site definitions and the associated pages. The site-context option can be used to specify a site for an operation.
  - Add prompts when deleting a page, if drafts of that page will be cancelled, or if children of that page will also be deleted.
  - Add --set-tag <tagname> to the push command, to optionally set a tag on assets, contents and types, when pushed
  - Add a warning after successful push, if --publish-now not specified and a publishing schedule is set, that may delay the publishing of the ready artifacts that were just pushed.
  - Update manifest support to handle placeholder sites
  - Update paging support to use the next links provided in service responses
  - Fix an issue with delete by page when receiving a 404 response.

### 3.1 changes since 3.0

  - Add latent support for push, pull, list, and compare of multiple sites. The artifact file name for a non-default site is based on the contextRoot property of the site. The artifact file name for a draft site is further qualifed by appending "_wchdraft" and the site's project id, if the site is part of a project.
  - Add support for push, pull, and list of pages by path. This is the same as the existing functionality for web assets, types, layouts, and layout mappings.
  - Add support for push, pull, list, and compare of orphaned resources.
  - Fix a bug with the creation of minimal asset metadata when run with the createOnly option.

### 3.0 changes since 2.9

  - NOTE:  The 3.0 major version number upgrade of wchtools has a change in default behavior.
    - The DEFAULT for pull, push, list and compare has been changed to only operate on "ready" items.
    - wchtools is commonly used to package up ready applications, sample or otherwise, to be transferred to another WCH tenant (staging to production, or a business partner building an application for a client) and you would typically only want the final (non-draft) ready items to be pulled from the staging tenant and sent to production tenant(s).
    - To obtain the prior (draft and ready, for content and assets) behavior, you may use the --draft and --ready command line arguments, to the push, pull, compare, and list commands.

### 2.9.2 changes since 2.8.2
  - New compare command for comparing source and target exports or source export with a target tenant, optionally writing a manifest of updates needed in the target, from the source, along with an optional manifest of items deleted from source that could then be deleted from the target with wchtools delete --manifest
  - New optional push --publish-now argument, to override a global publishing schedule, when you need to push and publish new web artifacts immediately, to address an issue.

### 2.8.2 changes since 2.7.6
  - Improve delete all to handle all drafts.
  - Improve preventaion of draft asset collisions.

### 2.7.6 changes since 2.7.3
  - Fix a regression in behavior when parsing command arguments for the init command.
  - Fix a problem when pulling orphaned resources that would cause the creation of a resource on the file system if the pull for the corresponding asset failed due to an intermittent error.
  - Update the behavior of pull --deletions to avoid deleting an existing manifest file that the process is currently writing to.

### 2.7.3 changes since 2.6.2
  - Add support for push, pull, and list of Layouts, Mappings and Content Types by path.
  - Add support for creating/updating a deletions manifest when pulling deletions.
  - For the case of deleting the results of a search (--named, --path, --by-type-name), an empty search result will be treated as a warning instead of an error.
  - Add support for --server-manifest to delete or pull based on a manifest residing in the tenant's Watson Content Hub artifacts (as opposed to --manifest which looks for the specified manifest in the local working directory, under /dxconfig/manifests assets).
  - Add support for clear --cache command to clear (invalidate) artifacts in the content delivery network cache
  - Changes related to simplification of WCH publishing flow:  - publishing job id removed from publish response and ignored on publish --status command.  No need to push/pull publishing sources and profiles, so those placeholder options have been removed.   publish --status shows state of the overall site revision (which it did before) but no longer shows status for the virtual publishing job, since that isn't the overall state of publishing for the tenant any longer.

### v2.6.2 changes since 2.5.2

 - Add ability to ignore conflicts involving unimportant differences when pushing.
 - Add support for pushing, pulling and listing ready artifacts. Use --ready to specify that only content types, content items, and content assets with a status of "ready" should be pulled/pushed/listed.
 - Fix issue in deleting assets and web assets via manifest.

### v2.5.2 changes since v2.4.5

 - Fix gap in list --path support so that the path filter applies to --server web assets too, not just local web assets.
 - Add --path support to pull command, to allow pulling web assets under a specific path, for consistency with push and list --path options.
   - Note, the --path filter is limited to web assets at this time.
 - Add ability to set retryMaxAttempts, retryMinTime and retryMaxTime config options via init command, to control retries on WCH API network/HTTP errors.

### v2.4.5 changes since 2.4.1

 - Improved retry handling to also retry http requests on network or socket level errors, not just HTTP 429 and 5xx errors.

### v2.4.1 changes since 2.3.4

 - Made pulling artifacts with invalid Windows filename characters less restrictive on other operating systems (previously raised a file path error for invalid Windows filename characters, on other operating systems).
 - Add limited pull -by-type-name support, for pulling content by type name and assets directly referenced by image and video elements, along with asset renditions (initial support includes only those artifacts; does not follow reference elements).  Categories and Image profiles should be pulled/pushed separately, and prior to using this, if attempting to use this to move content between tenants.  See the Readme for more information and description of limitations of this option.
 - Add support for pushing, pulling and deleting artifacts by manifest.  Use --manifest to specify a manifest file to use for push/pull/delete actions.  Use --write-manifest to generate or update a manifest based on the results of list, pull, and push operations.   Search for "manifest" in the Readme, for more information about working with manifests.

### v2.3.4 changes since 2.3.1

 - Improve error reporting when encountering corrupt and unparseable JSON (e.g. accidentally edited content json with syntax error).
 - More frequent notification of newer versions of wchtools (once every 10 mins since last checked vs once per day)
 - Allow multiple artifact types (content, types, assets) to be specified at once, for delete by tag. Previously only one artifact type could be specified at a time, for delete by tag.
 - Update log4js dependency from 1.1.x to 2.5.x.

### v2.3 changes since 2.2.8

 - PLEASE NOTE:  This version and newer will save content types by path (readable filename) rather than by id, like assets, layouts, pages and mappings, under workingdir/types.  Rather than workingdir/types/{ugly-uuid}_tmd.json types will now be stored as workingdir/types/{type-name}.json  on disk.   This more closely aligns with other files (assets, layouts and mappings) that the web developer typically browses and/or manages on disk.   Content, lacking a path field, is still stored by unique id value, when pulled to disk.

 - It is strongly suggested that all developers working on the same external copy of WCH artifacts with wchtools for a given project or WCH tenant, upgrade to this (or newer) version of wchtools at the same time, so that the external filename representation of content types is consistent across developers pulling those content types to disk (where older versions store types by id and this and newer versions store them by readable path and name).

 - Avoid pushing asset resources (eg, images, videos) that already exist in the tenant, by doing a HEAD request on the calculated resource id (md5 of hash and filename) to avoid unnecessary network traffic where the resource service will ignore a re-push of an existing resource and return HTTP 200 anyway.

### v2.2.8 changes since 2.2.1

 - Add latent support for colons appearing in content ids going forward in WCH Content API, when storing content by id.
 - Fix issue with updating an image resource on an existing managed asset.
 - Additional translated strings.

### v2.2 changes since 2.1.3

 - Add ability to delete --pages by --path and optionally also delete --page-content when deleting a page.
 - Add ability to pull --deletions, to be prompted (or quietly) delete local files not referenced by a full pull of all artifacts of the specified type(s).
 - Update readme to describe use of Federated IDs with wchtools and WCH REST APIs
 - Update readme to describe where to get NodeJS, that npm is installed with NodeJS, that recent 6.x is required for use with WCH Site SPA
 - Update list command to not attempt to list layouts, layout mappings, pages or sites, if using an Essentials tier tenant
 - Fix bug where delete path arg had implied you could use -p short form of --path, since -p is reserved as short form of --pages. Path must be specified via the full --path argument.

### v2.1.3 changes since v2.0.9

 - Temporarily disable pulling and pushing resources not associated with asset metadata, pending further authoring API improvements.
 - Create md5 hashes by stream rather than reading artifacts into memory first, to decrease memory use and improve performance
 - Minor usability improvements around error and warning message strings.
 - Check for asset metadata json file changes too (not just asset binary file changes) when using push modified.
 - Check for tenant tier before pulling -A (eg, to not attempt to pull layouts, mappings, sites and pages for Essentials tier WCH tenants)
 - Added ability to delete managed content assets by path with delete -a --path /dxdam/pathtofile (with optional trailing wildcard)
 - Added ability to delete content and types by id with delete -c --id {id} or -t --id {id}.
 - Added ability to delete assets, content and types by tag with delete -c --tag "tagname" or -T "tagname"
 - Added ability to delete content and types by name with delete -c --name {name} or -c --n {name}.
 - Added ability to delete content by type name, delete -c --by-type-name "type name".
 - Added ability to delete ALL instances of a specified artifact type (eg, all pages) or ALL artifacts, eg, with delete -A --all or -p --all
   Note, the WCH APIs won't allow deletion if something references that content or type, so this only deletes unreferenced content and types.

### v2.0.9 changes since 2.0.3

  - Added pull of image and video resources not referenced by asset metadata, during asset pull,  stored under workingdir/resources,  so that push to a new tenant where content references such resources, will work.
  - Fix for modified tracking issue when pulling publishing config (profiles, job definitions, site revision) multiple times.
  - Additional unit test coverage.

### v2 changes since v1.x

  - Added support for pushing and pulling site and page artifacts with -s -p
  - Fixed case of pushing/pulling publishing sources to -S to match uppercase publishing arguments
  - Added support for pulling draft assets without overwriting the ready version of the assets on disk
  - Added support for retry of additional artifact types (eg, on network or service load related errors)

### v1.4.11 changes since 1.4

  - Improved efficiency of metadata tracking for the pushed and pulled artifacts, to reduce CPU and disk I/O for working dirs with large numbers of artifacts
  - Improved output message when wchtools publish --status gets no publishing jobs back from the publishing jobs service endpoint
  - Avoid losing the original error message, when an asset upload fails while pushing the actual file to the resource endpoint.
  - Add alternate wchtools script, for launching node with a non-default (i.e. larger) maximum heap.  See Readme.md for more details

### v1.4 Changes since 1.3

  - Improved publish --status command output to include publishing site revision state, in addition to most recent or specified publishing job status
  - Improve retry support, on retryable HTTP errors and reference errors
  - Refactored internal API for better reuse across modules
  - Improved ordering of artifact push when pushing all artifacts (types before layout mappings)

### v1.3 Changes since 1.2.1

  - Add support for pushing and pulling layouts and layout mappings.
  - Add render command to kick off a render-only publishing job.

### v1.2.1 Changes since 1.1.13

 - Unit test tweak, to allow unit tests to be run from both Node 4.x and Node 6.x.
 - Add --url option to the publish command.
 - Add -f --force-override option to allow overriding revision conflicts when pushing authoring artifacts.
 - Changes to the delete command to support deleting assets by path name.
 - Changed category push/pull to skip out-of-the-box system categories.

### v1.1.13 Changes since 1.1.11

 - Report syntax error in authoring artifact json to console not just wchtools-api.log when skipping over invalid files.
 - Make publishing job id to publish --status arg optional, so that you can leave it off if you don't know the value and get the status of the most recent publishing job instead of a specified publishing job.
 - Update some dependencies to recent versions.
 - Mismatched md5 checksum between what the server says it's downloading and what wchtools receives is now reported as an error, instead of a warning.
 - Mention 'sudo' for installing via npm on Mac and Linux, in the Readme install instructions.

### v1.1.11 Changes since 1.1.7

 - Add user agent http header  (wchtools/version) to WCH REST requests
 - Add latent support for update-notifier to notify of future new versions of wchtools in npm registry, with ability to disable that by setting env var NO_UPDATE_NOTIFIER=true
 - Add retry support, for retrying push of content items that have reference errors (referring to not yet existing content) at the end of a push request,  to allow pushing packages of content containing references to each other, to a tenant that does not yet have any of those content items.
 - Logging improvements:  correctly flag errors with [ERROR] during verbose logging,  set wchtools-api.log level to WARN, to pick up warnings in addition to errors.
 - wchtools will now set a non-zero return status when pushing and pulling where 1 or more artifacts resulted in an error during a push or pull.  This enables build scripts running wchtools to better detect whether there were any network or service errors encountered during an otherwise successful push command.

### v1.1   Changes since 1.0.*

NOTE: Starting with release 1.1.*, please retrieve your Watson Content Hub tenant specific API URL from the Authoring UI "Hub Information" dialog, to configure wchtools.  This should be the same WCH tenant specific base API URL you use for all the public WCH samples and with the APIs in IBM API Explorer for Watson Content Hub as described here: https://developer.ibm.com/api/view/id-618:title-IBM_Watson_Content_Hub_API#getting
Follow the Readme instructions for installing the wchtools CLI and then the Getting Started instructions for obtaining and setting your WCH tenant specific API URL.

#### Configuration options improvements:

 - All config options files are now named .wchtoolsoptions, but can optionally be in current or specified working dir instead of always stored in the user home directory.
 - The init command now has options for a) the tenant specific WCH API URL and b) the location (--dir) where the options file should be saved, in addition to the user name option.
 - The init command changes the specified values in the appropriate options file, but does not change any other values defined in that options file (ie, won't overwrite manually configured overrides in the config file)
 - Support for push, pull, list, and delete commands to use the options file in the location specified with the --dir option.
 - Values from all relevant options files are used in priority order - location specified using the --dir option (highest priority), local working directory, user home directory, wchtools-api embedded config (lowest priority).
 - Allow fallback for automated scripts that are using x-ibm-dx-tenant-id in options override, (to not require API URL for now, until automation is updated)

#### CLI Command Changes:

 - Push now allows updating managed content assets (assets/dxdam/... ) with a new similar image (eg, for replacing a product image with a newer or better image of the same product).
 - Add new --url option to specify the tenant base API URL on an individual command (not common, but useful for scripting tests and for business partners building applications for multiple clients).
 - Ability to push and pull publishing profiles and site revisions and fixed the name of "publishing-sources" folder (previously "sources") for consistency and to indicate what it's for.
 - Fixed the case consistency of long-form arguments (short form arguments are still recommended, the long form is there primarily for additional user info when running the --help command)

#### Other

 - Remove unused and deprecated presentation support from push/pull/list commands
 - Improvement to publishing job status verbose output

### v1.0.2

 - Fix for "web asset" issue where it was treating web assets as unmodifiable managed assets after two pushes.

### v1.0.1

 - Fix for list command not computing local changes properly when not logged in
 - Rename leftover root owned log file after install on linux and Mac, to avoid permissions issue if wchtools is then accidentally run from the temporary install folder.
 - Update components to allow unit tests to run from clone of source repository.
