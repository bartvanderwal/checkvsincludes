CheckVSIncludes
===============

No it's is NOT `Check` versus `Includes`, this Node module is to check that your **V**isual **S**tudio includes are O.K.

It might be a shock to some but yes, Microsoft is coming to Node.js, or actually has been coming for a while. They're finally following, but they'll probably be taking lot's of new developers for them. Below I'll give some situations this module can help you, but since you're reading you probably just want to use it, so let's dive straight into how to do that.

### How to use it
- [Install Node](https://nodejs.org) - if you didn't have it yet.
- `npm install checkvsincludes`
- Add a Grunt or Gulp task
- If you prefer VS over the command line you should install the [Task Runner Explorer extension](https://visualstudiogallery.msdn.microsoft.com/8e1b4368-4afb-467a-bc13-9650572db708)

### Gulp t
Create a 'gulpfile.js' in your project and add a 
``

### Grunt task

### When to use it?
When your project uses Visual Studio's Web deploy it is necessary that every file that needs to be deployed is included in Visual Studio.
Sometimes files can be missing, when there is a developer in a project that does NOT use Visual Studio but another IDE or editor, and adds new files.
Also when merging the .csproj files can go missing, without you noticing this when testing on your local machine.

Missing files can lead to unexpected bugs

###What do you mean with 'includes'?

Visual Studio (VS) - Microsoft's main IDE - organizes it's files into a **solution**, and a solution consists of one or more `projects`. As most VS developers will know all the files that


