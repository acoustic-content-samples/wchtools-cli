# Changelog

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
