# wchtools
## IBM Watson Content Hub Developer Tools


### Summary
The IBM Watson Content Hub Developer Tools provide a command line interface (CLI) based utility called wchtools for working with Watson Content Hub. This utility allows developer or other users to upload (push) and download (pull) any content, assets, and content model artifacts from Watson Content Hub. With the tool you can easily install sample packages or pull authoring artifacts for archiving locally. You can also use it for bulk upload of assets such as images, and to trigger a publishing job to publish your "ready" assets.


### License and Notices
Please review the [LICENSE](https://github.com/ibm-wch/wchtools-cli/blob/master/LICENSE) and [NOTICE](https://github.com/ibm-wch/wchtools-cli/blob/master/NOTICE) files at the root of this project's git repository before you download and get started with this toolkit.

### Install
 Pre-Requisite: Before you install the wchtools CLI, you must install Node 4.3 or a later 4.x version. IBM Node 4.6 or a later 4.x version is suggested.

 You may install the wchtools CLI as a node module directly from the npm registry at https://npmjs.com,  or by downloading and installing a release from the wchtools-cli git repository.

#### Installing the wchtools-cli module from the npm registry

Execute the following npm command, to install the wchtools CLI module and its dependencies from the npm registry:

  -For Windows:

       npm install -g wchtools-cli

  -For Mac or Linux:

       sudo npm install -g wchtools-cli

Then follow the Getting Started instructions below, to configure and start using the wchtools command.

#### Installing from a release in this git repository

 Complete the following steps to install and run the wchtools CLI from a downloadable release in the git repository:

   1. Download the latest wch.developer.tools.zip release available from the [releases](https://github.com/ibm-wch/wchtools-cli/releases) page of the wchtools-cli git repository and extract the files to a temporary folder on your local filesystem.

   2. Run the installation command from that temporary folder as follows:-

 Note: To uninstall a currently installed version before you install a specific version, for example, to rollback to a prior version for a specific test, run the reinstall command script. The reinstall command script uninstalls then installs for you.

  -For Windows:

        - Run the install command for both initial install and upgrade.

         or

        - To uninstall the current version and then install, run the reinstall command.

  -For Mac or Linux:

        - Run sudo chmod a+x ./install.sh and then sudo ./install.sh for both initial install and upgrade.

        or

        - To uninstall the current version and then install, run the sudo chmod a+x ./reinstall.sh and sudo ./reinstall.sh.  


### Notification of updated versions of wchtools

  By default, the wchtools CLI uses the update-notifier node module to check the npm registry for a newer version of wchtools-cli module than the one you have currently installed on your system.   The check runs as an asynchronous background task, to avoid slowing down your wchtools commands, and will notify you on the next successful execution of wchtools after it detects that there is a newer version.

   - To avoid nagging you, when you know there's a newer version but aren't ready to update yet,  it only checks once per day, and will only notify you once within that one day interval.

   - To disable checking the npm registry for a newer version and notification of updates, set the environment variable NO_UPDATE_NOTIFIER to any value, prior to executing wchtools CLI.   You may set this as a persistent environment variable manually for your OS or unix shell profile script,  or in a build script, if wchtools is run as part of a build process.


### Getting Started

  After you successfully install the wchtools CLI, initialize the username and the API URL for your Watson Content Hub tenant.   Obtain the API URL from the "Hub Information" dialog available off the top navigation bar of the content hub authoring UI.  The API URL is of the form:  https://{tenant-host}/api/{tenant-id}

  e.g.:

      wchtools init
      User: myWCHusername@mycompany.com
      API URL: https://my11.digitalexperience.ibm.com/api/00000000-1111-2222-3333-444444444444


  Then try the following commands:

    wchtools --help
        - Use this command to get a list of all commands.

    wchtools  push --help
        - Use this command to get a list of all options for the push command.

    wchtools  pull --help
        - Use this command to get a list of all options for the pull command.


### Local filesystem layout and working directory

  The wchtools CLI utility operates against a working directory, and requires specific folders as direct children of that working directory.  Each child folder of the working directory separates artifacts based on the Watson Content Hub service that manages those artifacts.

  The working directory for the root of this filesystem layout is either the current directory where the wchtools CLI is run, or the path that is specified by the specified by the --dir argument.

  The actual authoring or web resource artifacts are stored in the following subfolders under the working directory.

    <working dir>
       assets/...          ( Non-managed (web resource) assets, such as html, js, css, managed with wchtools, not authoring UI)
       assets/dxdam/...    ( Managed Authoring Assets, uploaded via Authoring UI and tagged with additional metadata )
       categories/         ( authoring categories and taxonomies)
       content/            ( authoring content items)
       image-profiles/     ( authoring image profiles )
       renditions/         ( authoring renditions )
       sources/            ( publishing sources )
       types/              ( authoring content types )


### Sample Usage and Commands

#### Pushing sample content from a local file system
  To push a sample that you extracted to a local working directory that contains the above subfolders of authoring artifacts, run the following command:

      wchtools push -A --dir <path-to-working-directory>

  That command  pushes all authoring artifacts such as content model, content, and assets from the specified working directory and its subfolders. You can add the "-v" to enable verbose logging.

#### Pulling content to a local file system

  To pull (export) all content model, content, and assets to a local working directory, run the following command:

    wchtools pull -A --dir <path-to-working-directory>

  When you pull artifacts from the Watson Content Hub authoring services, wchtools CLI creates folders for types, assets, and content under the working directory. The tool does not operate on raw artifacts in a current working directory. You must specify the <working-directory> parent of the subfolders that contain the contain artifacts, or be in the <working-directory> parent folder that contains such subfolders, when you run wchtools CLI with the push, pull or list commands.

#### Uploading new managed content assets such as images

  To upload a number of files into Watson Content Hub with a single command, copy the files into the assets/dxdam/ folder under your working directory. Then, run the following command:

    wchtools push -a --dir <path-to-working-directory>

  That command uploads managed assets as described previously.

#### Uploading web assets such as html, Javascript and CSS

  Web resource assets are manipulated only via the wchtools CLI at this time and not by the Authoring UI.  To upload web resource assets, place them below the assets folder in your working directory anywhere except under assets/dxdam/... path, then push -A for all authoring artifacts or -w to push only web resource assets.

    wchtools push -w --dir <path-to-working-directory>

#### Deleting non-managed web assets such as html, Javascript and CSS, from the Watson Content Hub

  Since non-managed (not located under assets/dxdam/...) web application assets are manipulated only via the wchtools CLI at this time and not by the Authoring UI, you must use wchtools to delete a web application asset, should you choose to do so.  To delete a web application asset, specify the portion of the asset path that was below the <working-directory>/assets/  folder, when you pushed the web resource, as shown in the following command.

    wchtools delete -w --path js/mytestscript.js

  The delete command supports the following options:

    -p --path <path> this specifies the path to the artifacts to delete
    -r --recursive this specifies whether the delete should apply recursively to all descendants of the matching path
    -P --preview this specifies whether to simply preview the artifacts to be deleted, but does not actually execute the delete operation
    -q --quiet this specifies whether the user should be prompted for each artifact to be deleted

  The --path and --recursive options are interpreted by the delete command according to the following:

  - If the path ends with the wildcard '*' and --recursive is supplied, the action will recursively match all artifacts that start with the supplied path
  - If the path does not end with a '*' and --recursive is supplied, the action will recursively match all descendants of the supplied folder
  - If the path ends with the wildcard '*' and --recursive is not supplied, the action will match all artifacts that start with the supplied path but will not match any children of the artifacts
  - If the path does not end with a '*' and --recursive is not supplied, the action will match only the path supplied by the user.  If this path is a folder, the direct children of the folder will match.

#### Triggering a publish job
  By default, authoring artifacts such as assets are published to the delivery system when they are uploaded and authoring artifacts such as content are moved from draft to ready state. Therefore, an explicit publish command is not necessary.   If needed, you can use wchtools CLI to trigger an explicit publish with the following publish command. The publish command updates publish by default, that is, it publishes only the artifacts that are not already in the delivery system.

    wchtools publish --verbose

  Note: Publishing currently uses the default publishing source and publishing profile.

  If for some reason the published artifacts need to be republished, you can do a "rebuild" publish with the following command.
  Note: Republishing artifacts is not a typical use case.

    wchtools publish -r --verbose

  Both of the above publish commands display the publishing job id on successful creation of a publishing job.  The following command may be used (with or without --verbose) to see the current status of the specified publishing job.

    wchtools publish --status [<id>] [--verbose]

  If the optional id is not specified to the publish --status command, then the status of the most recent publishing job found will be shown.


#### Defaults
  By default, wchtools CLI pushes only the authoring artifacts and web resources that are not modified, since the last successful push or pull.  To push or pull artifacts again whether they are modified or not since the last successful push or pull, use the -I option to Ignore-timestamps.

  An initial push of a starter kit or sample package is done to populate the initial authoring artifacts. Those authoring artifacts and successive ones are typically manipulated in the Watson Content Hub web based Authoring UI and not locally on the filesystem. Web resource artifacts such as html, css, js, and handlebars templates are managed and edited externally and pushed to the Watson Content Hub with the wchtools CLI utility. Therefore, the default is to push and pull only web resource artifacts, if no options are specified to the push and pull commands.

  Use the following command to push only web resource artifacts that have been modified locally since they were last pushed or pulled.

    wchtools push

  Use the following command to pull only the assets, content, and types that were modified since your last pull.

    wchtools pull -act

  Use the following command to pull assets, content, and types, ignoring timestamps.  This allows you to pull these artifacts whether they were  modified or not since the last successful pull or push, to or from this working directory.

    wchtools pull -act --I

  Use the following command to pull to a specific directory.

    wchtools pull --dir <some directory>

  Pushing and pulling assumes the <working-directory>/<artifact-type> folder structure that was described earlier. To allow for a more granular push of web resource assets, with an option for a path below the <working-directory>/assets/ root path, you can push only a subset of web resource assets. For example, consider a working directory named  c:\work on Windows or ~/work on Linux or Mac, with an assets/ subfolder, and the assets folder contains its own subfolders: simpleSpa , topNav, sideNav.

   - To push only the topNav assets, you would use

              wchtools push --path topNav/

   - To push only the style folder that is below the topNav folder, you would use

             wchtools push --path topNav/style

   - To push assets from a specific working directory, use

            wchtools push --dir <somedirectory>

     This command assumes that the specified directory has an assets/ subtree that contains all assets.

#### Granular Options

NOTE:  Granular options such as pushing only one or more artifact types at a time, are not typically used. Granular options must be used only when instructed by support or by explicit package instructions, for a very specific use case.  Since artifacts reference each other by embedded identifiers, it is easy to cause referential integrity errors by trying to push artifacts by artifact type without having pushed artifacts that they depend on yet. The push -A command that is used to push all authoring artifacts at the same time, pushes them in dependency order. The order helps to preserve the referential integrity of the artifacts and the overall content as a whole.

   Use the following command to push only modified artifacts for assets, content, and types.

           wchtools push -act

  Use the following command to push all categories, assets, contents, types and sources from a specific directory. The -I switch pushes even unmodified items.

           wchtools push -Cacts  --I --dir <some_working_directory>

#### Site Revision and Auto-Publishing

Auto-publishing is enabled by default, meaning that each time you push a web or managed asset to the authoring service, it will be published to the CDN, and each time you make a content item ready in the UI or by pushing a new ready item, it will be published to the content delivery service.   If you need to disable auto-publishing, to make a series of changes before any of them are published to the delivery services, you may do so by using wchtools to pull the default site revision, disable auto publishing and then push the site revision back to the publishing manager.

           wchtools pull -R -v --dir <working_directory>
           edit <somedirectory>/site-revisions/default_srmd.json  and change the "autoPublishEnabled" value to false
           wchtools push -R -v --dir <working_directory>

After you disable auto-publishing, you may either invoke a publish manually with "wchtools publish -v"  or you may re-enable auto-publishing again using the above steps and changing the "autoPublishEnabled" value back to true, before making your final updates to the assets and content.

#### Logging
  The Watson Content Hub public APIs that the wchtools CLI utility uses, provides server side logging. The server side logging aids customer support in helping you diagnose an issue if problems occur when you use Watson Content Hub from the authoring UI or the command line tools. The wchtools creates 2 log files locally, in the current directory to aid you the user to identify causes of issues that you can fix. For example, an issue in the artifacts you're trying to push.

     - wchtools-cli.log - Contains command log, for commands run through wchtools.
     - wchtools-api.log - Contains errors, if any, encountered while you ran commands against Watson Content Hub authoring and publishing services.

  Using the -v or --verbose option with wchtools commands, logs additional information about the status of the command and any error information to the output console while the command is running.

#### Localization
  The command descriptions and usage messages are translated into a few languages to assist users who use other languages with the tool. The messages fall back to English if translations for the current OS locale are not found. A dependent node module attempts to determine the locale from the OS localization settings.  If you need to or choose to change the locale back to English for communicating issues or questions with others, you may set the environment variable LANG=en  in the command shell environment where you are running wchtools. To see the current languages available, look under the CLI/nls folder in the git repository for this tool.

#### Ignore Files
  Some local files and folders should not be stored in Watson Content Hub, including for example, project files, source control data, logs, and backups. By default, the wchtools CLI will ignore these local files and folders for the push and list commands.

  To ignore additional local files and folders, a file named <i>.wchtoolsignore</i> can be added to the "assets" virtual directory. For example, to ignore all local files with the "abc" extension and all files within the local "xyz" folder, the ignore file could contain the following lines:

     *.abc
     xyz/

  To ignore only the local files and folders specified by the ignore file in the "assets" virtual directory (overriding the default behavior), the "is_ignore_additive" property can be set to false in the .wchtoolsoptions file.

     "is_ignore_additive": false

  By default, the .wchtoolsoptions file can be found in the user's home directory after running the init command.

#### Creating and managing templates, layouts and layout mappings

 - Watson Content Hub now supports Handlebars templates for rendering purposes, where a content type and item can be mapped to a layout object, via layout mapping, where the layout object then refers to a handlebars template, that is associated with that content type.
 
 - For example, you can create a handlebars template under working-dir/assets/templates/article.hbs  for the "Article" content type
 
               <div>
                 ...
                   <img src="{{elements.image.url}}" alt="" width="360" height="225">
                 ...
                   <h4 style="color:#000;padding:25px 0px 5px 0px">
                       <a>{{elements.title.value}}</a>
                   </h4>
               </div>
   
  - The above handlebars file then needs to be described to the Authoring and Publishing/Rendering system via a Layout, which provides additional metadata for those services to identify and find the template.  Create a Layout for your new Article template under workingdir/layouts/templates/article.json  with metadata like this:
  
           {
             "id": "defaultArticleLayout",
             "name": "Default Article Layout",
             "prerender": true,
             "template": "/templates/article.hbs"
           }

  - To let the Authoring and Publishing/Rendering services know that you want this new template and layout associated with your Article content type, you then need to create a "Layout Mapping" under workingdir/layout-mappings/templates/article.json like this:
  
           {
             "id": "articleLayoutMapping",
             "name": "My Article Layout Mapping",
             "type": {
               "name": "Article"
             },
             "mappings": [
               {
                 "defaultLayout": {
                   "id": "defaultArticleLayout",
                   "name": "Default Article Layout"
                 },
                 "layouts": [
                   {
                     "id": "defaultArticleLayout",
                     "name": "Default Article Layout"
                   }
                 ]
               }
             ]
           }
  
  - Note, the content "Type" can be referenced from the layout mapping by "name", but the "layout" has to be referenced by "id" at this point, so be sure to give your layout a developer readable and remember-able "id" field when you create it, so that you can easily reference it when creating the layout mapping metadata in the above format.
  
  - Now that you have created an hbs template, a layout object and a layout mapping object for your article type, you may push those all to Watson Content Hub with the following command:
  
             wchtools push -wlm -v --dir <some_working_directory>

  - Note, push -A (for all Authoring artifacts) will also push the web assets, layouts and mapping.

  - Note, the above sample using the "/templates" folder under assets, layouts and layout-mappings is an example for reference only.  You may choose another folder name and multiple subfolder levels if desired.  It is recommended that you keep the folder names and filenames under assets, layouts and layout-mappings,   and the name of the template, layout and layout mapping files similar and similar to the Type name that you are creating these artifacs for,  to make it easier to find when making further edits, and to make it easier for others on your team to understand the relationship between the files quickly and easily, when browsing the local artifacs in an IDE.
  
  - See the Watson Content Hub online documentation for more information on Layout, Layout Mapping syntax and metadata supported, and the Publishing and Rendering documentation, for how these artifacts are combined during a publishing and rendering job, to generate HTML.
  
#### Specifying maximum heap size
  The maximum heap size used for the node process can be specified by setting an environment variable and running an alternate command provided with Watson Content Hub Developer Tools.  An alternate command "wchtools_heap" provides the ability to configure the maximum heap used by node.  To set the maximum heap, set the environment variable WCHTOOLS_MAX_HEAP to a numeric value, specified in megabytes.  For example, to use a 2GB heap, set WCHTOOLS_MAX_HEAP=2048.

  On linux launch Watson Content Hub Developer Tools using:

            export WCHTOOLS_MAX_HEAP=2048
            wchtools_heap push ...
  
  On Windows launch Watson Content Hub Developer Tools using:
  
            set WCHTOOLS_MAX_HEAP=2048
            wchtools_heap push ...

#### Limitations
  The wchtools functions are limited by what the Watson Content Hub public REST APIs allow, including but not limited to the following list:

  - The authoring APIs and services do not allow you to push an update to an authoring artifact, where the "revision" field of the item you are trying to push does not match the current revision stored that is stored on the server by the authoring service. This action is enforced by the services to help prevent overwriting newer updates by another user through authoring UI with an older copy of an artifact.  If a wchtools push encounters such a 409 conflict error for an authoring artifact or artifacts, each conflicting copy is saved to the appropriate artifact subfolder with a "conflict" suffix. You can compare the files locally to determine which changes are appropriate.  If you determine that it is safe to override the conflicting server changes with your local artifacts, you may try pushing again with the -f or --force-override options to ask the authoring services to override the revision conflict validation.
  
  - The authoring content service does not allow pushing a "ready" state content item, if that content item currently has a "draft" outstanding. You can push a draft content item, whether a draft exists, or no artifact exists for that content ID. But you cannot push a "ready" content item if that item has a draft.  If you must push a ready item, for example, to recover from a server side mistake, where a draft exists, you can cancel the draft and try again. Or you can fix the issue with the authoring UI and then pull the content down to the local filesystem again for archiving.

  - Authoring artifacts refer to each other by internal identifiers (the 'id' field). The Watson Content Hub authoring services enforce validation of referential integrity as artifacts are created or updated through the public REST APIs.   For this reason, it is suggested that you use the -A or --All-authoring options when you push authoring artifacts. This option is not needed if you are pushing up only a new set of low level artifacts such as content types (where you could use -t to specify that's what what you want to push). Low-level artifacts are those artifacts without references to other types of artifacts. The all authoring artifact options push artifacts in order from those with no dependencies, to those with the most dependencies. This ordering helps avoid issues where dependent artifacts don't exist yet on the server, during a push.

#### Git Repository
  The IBM Watson Content Hub Developer Tools are provided as open source and made available in github.
  While it is not necessary to obtain the source from the github repository in order to install the release version of wchtools, you may choose to clone the github repository to access the source for the developer tools.  After cloning the github repository you can run npm install from the root folder of the local copy.
  - npm install

  Unit tests for the developer tools are provided in the github repository and can be run by executing:
  - npm run unit
