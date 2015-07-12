CheckVSIncludes
===============

**TODO**

 - Write Unit tests
 - Add clear usage example, also for Grunt
 - Add check that there are no `.cshtml' with build action `None` (can also cause deploy bugs)

Using Visual Studio Web Deploy and had some nasty issues because files were not **included** in your project?
Do you want to prevent this from ever happening again? Well I did, and because I couldn't find a generic solution to it yet - not even on [Stack Overflow](http://stackoverflow.com/questions/7271471/how-do-i-find-files-that-are-missing-from-visual-studio-projects) - so I created this Node application.

### How to use it
- [Install Node](https://nodejs.org) - if you didn't have it yet.
- run `npm install check-vs-includes` in node command prompt
- Add a Grunt or Gulp task (see below)
- Since you're using Visual Studio anyway you might prefer to install  [Task Runner Explorer extension](https://visualstudiogallery.msdn.microsoft.com/8e1b4368-4afb-467a-bc13-9650572db708) instead of using the command line.

### Gulp t
Create a 'gulpfile.js' in your project and add a task: 

```javascript
  var checkVSIncludes = require('check-vs-includes');
  ...

  gulp.task('checkVSIncludes', function(cb) {
     checkVSIncludes(['/Content/**/*.less', '/app/**/*.js'], { cwd: 'MyApp.Web' });
  });
```

### Grunt task
I don't know, I'm not a gruntee :P. But input is welcome!

### Command line
**STILL TODO** Allow running check-vs-includes on the command line.
Then you could run it after doing a global install.
I'm yet to get better acquanted with [yarg](https://www.npmjs.com/package/yargs)

### When to use it?
When your project uses Visual Studio's Web deploy it is necessary that every file that needs to be deployed is included in Visual Studio. E.g. in the project file (.csproj file as used by VS internally). But sometimes files can be missing, for instance when there is a developer in your project who doesn't use Visual Studio as (main) IDE. You the real frontend developers often prefer Atom, Brackets, Sublime or one of those other hip editors.

But even with only Visual Studio afficionado's in your team, files can be missing due to merging the .csproj files for instance with GIT, and then lazily choosing. The project is running fine on your localhost, but after you deploy, things can go haywire. Once this happens a manager might insist to add a bullet point in your deploy scrip to check that all files are included. But if you're working on a project of any real-life size this means you'll have to manually open 100 folders or more.

###What do you mean with 'includes'?
Visual Studio (VS) - Microsoft's main IDE - organizes it's files into a **solution**, and a solution consists of one or more `projects`. As most VS developers will know all the files that are included in the project are listed in the internal .csproj file. This is simply an XML file.

