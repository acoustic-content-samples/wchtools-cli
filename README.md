# wchtools
## IBM Watson Content Hub Developer Tools


### Summary
The IBM Watson Content Hub Developer Tools provide a command line interface (CLI) based utility called wchtools for working with Watson Content Hub. This utility allows developer or other users to upload (push) and download (pull) any content, assets, and content model artifacts from Watson Content Hub. With the tool you can easily install sample packages or pull authoring artifacts for archiving locally. You can also use it for bulk upload of assets such as images, and to trigger a publishing job to publish your "ready" assets.


### License and Notices
Please review the [LICENSE](LICENSE) and [NOTICE](NOTICE) files at the root of this repository before you download and get started with this toolkit.

### Install
 Pre-Requisite: Before you install the wchtools CLI, you must install Node 4.3 or later 4.x. IBM Node 4.6 or later is suggested.
 
 Complete the following steps to install and run the wchtools CLI:

   1. Download the latest release available from the [releases](../../releases) area and extract the files to a temporary folder on your local filesystem.

   2. Run the installation command from that temporary folder as follows:-

 Note: To uninstall a currently installed version before you install a specific version,for example, to rollback to a prior version for a specific test, run the reinstall command script. The reinstall command script uninstalls then install steps for you.

  -For Windows:

        - Run the install command for both initial install and upgrade.

         or

        - To uninstall the current version and then install, run the reinstall command. 

  -For Mac or Linux:

        - Run sudo chmod a+x ./install.sh and then sudo ./install.sh for both initial install and upgrade.
        
        or
        
        - To uninstall the current version and then install, run the sudo chmod a+x ./reinstall.sh and sudo ./reinstall.sh.  


### Getting Started

  After you successfully install the wchtools CLI, try the following commands:

    wchtools --help 
        - Use this command to get a list of all commands.
         
    wchtools  pull --help     
        - Use this command to get a list of all options for a command such as pull or push.
        
    wchtools init
        - Configure wchtools CLI to work with a specific user. Use this command to initialize the configuration with a specified user rather than specifying the user as an argument or at a prompt every time.

   
### Local filesystem layout and working directory

The wchtools CLI utility requires a specific filesystem layout. The file system must separate the authoring and web resource artifacts by the artifact types and the Watson Content Hub public APIs and services that store those artifacts.

  The working directory for the root of this filesystem layout is either the current directory where the wchtools CLI is run or the path that is specified by the specified by the --dir argument.

  The actual authoring or web resource artifacts are stored in subfolders under the working directory.

    <working dir>
       assets/...          ( Non-managed web resource assets, such as html, js, css, managed with wchtools, not authoring UI)
       assets/dxdam/...    ( Managed Authoring Assets, uploaded via Authoring UI and tagged with additional metadata )
       categories/         ( authoring categories and taxonomies)
       content/            ( authoring content items)
       image-profiles/     ( authoring image profiles )
       presentations/      ( authoring presentations )
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

  When you pull artifacts from the Watson Content Hub authoring services, wchtools CLI creates folders for types, presentations, assets, and content under the working directory. The tool does not operate on raw artifacts in a current working directory. You must specify the <working-directory> parent of the subfolders that contain the contain artifacts, or be in the <working-directory> parent folder that contains such subfolders, when you run wchtools CLI with the push, pull or list commands.
 
#### Uploading new assets such as images

  To upload a number of files into Watson Content Hub with a single command, copy the files into the assets/dxdam/ folder under your working directory. Then, run the following command:

    wchtools push -a --dir <path-to-working-directory>

  That command uploads managed assets as described previously.
 
#### Triggering a publish job
  By default, authoring artifacts such as assets are published to the delivery system when they are uploaded and authoring artifacts such as content are moved from draft to ready state. Therefore, an explicit publish command is not necessary.   If needed, you can use wchtools CLI to trigger an explicit publish with the following publish command. The publish command updates publish by default, that is, it publishes only the artifacts that are not already in the delivery system.
  
    wchtools publish --verbose
  
  Note: Publishing currently uses the default publishing source and publishing profile.

  If for some reason the published artifacts need to be republished, you can do a "rebuild" publish with the following command. 
  Note: Republishing artifacts is not a typical use case.
  
    wchtools publish -r --verbose

  Both of the above publish commands display the publishing job id on successful creation of a publishing job.  The following command may be used (with or without --verbose) to see the current status of the specified publishing job.
 
    wchtools publish --status <id> [--verbose]
    
    
#### Defaults
  By default, wchtools CLI pushes only the authoring artifacts and web resources that are not modified, since the last successful push or pull.  To push or pull artifacts again whether they are modified or not since the last successful push or pull, use the -I option to Ignore-timestamps.

  An initial push of a starter kit or sample package is done to populate the initial authoring artifacts. Those authoring artifacts and successive ones are typically manipulated in the Watson Content Hub web based Authoring UI and not locally on the filesystem. Web resource artifacts such as html, css, js, and handlebars templates are managed and edited externally and pushed to the Watson Content Hub with the wchtools CLI utility. Therefore, the default is to push and pull only web resource artifacts, if no options are specified to the push and pull commands.
  
  Use the following command to push only web resource artifacts that have been modified locally since they were last pushed or pulled.
  
    wchtools push

  Use the following command to pull only the presentations,assets,content,and types items that were modified since your last pull.
  
    wchtools pull -pact

  Use the following command to pull the presentations,assets,content,and types by ignoring timestamps whether they were  modified or not since the last successful pull or push.
  
    wchtools pull -pact --I

  Use the following command to pull to a specific directory.
  
    wchtools pull --dir <somedirectory>

  Pushing and pulling assumes the <working-directory>/<artifact-type> folder structure that was described earlier. To allow for a more granular push of web resource assets, with an option for a path below the <working-directory>/assets/ root path, you can push only a subset of web resource assets. For example, consider a working directory named  c:\work on Windows or ~/work on Linux or Mac, with an assets/ subfolder, and the assets folder contains its own subfolders: simpleSpa , toNav, sideNav.
  
   - To push only the topNav assets, you would use 
  
              wchtools push --path topNav/
 
   - To push only the style folder that is below the topNav folder, you would use
  
             wchtools push --path topNav/style

   - To push assets from a specific working directory, use 
  
            wchtools push --dir <somedirectory>

     This command assumes that the specified directory has an assets/ subtree that contains all assets. 

#### Granular Options

NOTE:  Granular options such as pushing only one or more artifact types at a time, are not typically used. Granular options must be used only when instructed by support or by explicit package instructions, for a very specific use case.  Since artifacts reference each other by embedded identifiers, it is easy to cause referential integrity errors by trying to push artifacts by artifact type without having pushed artifacts that they depend on yet. The push -A command that is used to push All-authoring artifacts at the same time, pushes them in dependency order. The order helps to preserve the referential integrity of the artifacts and the overall content as a whole.

   Use the following command to push only modified artifacts for assets, content, and types.
  
           wchtools push -act

  Use the following command to push all categories, presentations, assets, contents, types and sources from a specific directory. The -I switch pushes even unmodified items.
  
           wchtools push -Cpacts  --I --dir <somedirectory>


#### Logging
  The Watson Content Hub public APIs that the wchtools CLI utility uses, provides server side logging. The server side logging aids customer support in helping you diagnose an issue if problems occur when you use Watson Content Hub from the authoring UI or the command line tools. The wchtools creates 2 log files locally, in the current directory to aid you the user to identify causes of issues that you can fix. For example, an issue in the artifacts you're trying to push. 
  
     - wchtools-cli.log - Contains command log, for commands run through wchtools.
     - wchtools-api.log - Contains errors, if any, encountered while you ran commands against Watson Content Hub authoring and publishing services.
  
  Using the -v or --verbose option with wchtools commands, logs additional information about the status of the command and any error information to the output console while the command is running.

#### Localization
  The command descriptions and usage messages are translated into a few languages to assist users who use other languages with the tool. The messages fall back to English if translations for the current OS locale are not found. A dependent node module attempts to determine the locale from the OS localization settings.  If you need to or choose to change the locale back to English for communicating issues or questions with others, you may set the environment variable LANG=en  in the command shell environment where you are running wchtools. To see the current languages available, look under the CLI/nls folder in the git repository for this tool.

#### Limitations
  The wchtools functions are limited by what the Watson Content Hub public REST APIs allow, including but not limited to the following list:
  
  - The authoring APIs and services do not allow you to push an update to an authoring artifact, where the "revision" field of the item you are trying to push does not match the current revision stored that is stored on the server by the authoring service. This action is enforced by the services to help prevent overwriting newer updates by another user through authoring UI with an older copy of an artifact. It is not currently possible to override this server side validation. If a wchtools push encounters such a 409 conflict error for an authoring artifact or artifacts, each conflicting copy is saved to the appropriate artifact subfolder with a "conflict" suffix. You can compare the files locally to determine which changes are appropriate. Then, fix up the local copy to contain the correct revision and server side modified fields, and then try to push again.
  
  - The authoring content service does not allow pushing a "ready" state content item, if that content item currently has a "draft" outstanding. You can push a draft content item, whether a draft exists, or no artifact exists for that content ID. But you cannot push a "ready" content item if that item has a draft.  If you must push a ready item, for example, to recover from a server side mistake, where a draft exists, you can cancel the draft and try again. Or you can fix the issue with the authoring UI and then pull the content down to the local filesystem again for archiving.

  - Authoring artifacts refer to each other by internal identifiers (the 'id' field). The Watson Content Hub authoring services enforce validation of referential integrity as artifacts are created or updated through the public REST APIs.   For this reason, it is suggested that you use the -A or --All-authoring options when you push authoring artifacts. This option is not needed if you are pushing up only a new set of low level artifacts such as content types (where you could use -t to specify that's what what you want to push). Low-level artifacts are those artifacts without references to other types of artifacts. The all authoring artifact options push artifacts in order from those with no dependencies, to those with the most dependencies. This ordering helps avoid issues where dependent artifacts don't exist yet on the server, during a push.

#### Git Repository
  The IBM Watson Content Hub Developer Tools are provided as open source and made available in github.
  While it is not necessary to obtain the source from the github repository in order to install the release version of wchtools, you may choose to clone the github repository to access the source for the developer tools.  After cloning the github repository you can run npm install from the root folder of the local copy.
  - npm install

  Unit tests for the developer tools are provided in the github repository and can be run by executing:
  - npm run unit
