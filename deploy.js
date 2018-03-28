// WARNING: Script functions here are not intended to be ran manually. Those are intended to be part of a chain process to handle asynchronous nature of the FTP client.

// eslint-disable no-console
const Client = require('ftp');
const { argv } = require('yargs');
const fs = require('fs');
const now = require('performance-now');

const c = new Client();

// Change this configuration according to your preference.
const config = {
  host: argv.ftp_host,
  user: argv.ftp_user,
  password: argv.ftp_password
};

// Location of Laravel's root installation
const publicPath = '/';

// Location of your Laravel views folder
const viewPath = '/resources/views';

let filesToUpload = [];
const subdirectories = [];

// Transfers .htaccess from server/public_backup to server/public
function transferHtaccessToPublic() {
  console.log('Finalizing FTP deployment (2/2)...');
  c.rename(
    `${publicPath}/public_backup/.htaccess`,
    `${publicPath}/public/.htaccess`,
    err => {
      if (err) {
        console.log('Finalizing FTP deployment (2/2) failed!');
        throw err;
      }
      console.log('FTP Deployment Finish!');
      c.end();
    }
  );
}

// Deletes index.html from server/public
function removeIndexFromPublic() {
  console.log('Finalizing FTP deployment (1/2)...');
  c.delete(`${publicPath}/public/index.html`, err => {
    if (err) {
      console.log('Finalizing FTP deployment (1/2) failed!');
      throw err;
    }
    transferHtaccessToPublic();
  });
}

// Recursively uploads file to server/public
function uploadPublicFile(files) {
  let newFiles = files;
  const start = now();
  console.log('Uploading:', files[0]);
  c.append(
    `${__dirname}/public/${files[0]}`,
    `${publicPath}/public/${files[0]}`,
    err => {
      if (err) {
        console.log(`Uploading ${files[0]} failed!`);
        throw err;
      }
      console.log(
        `${((now() - start) / 1000).toFixed(2)}s Uploaded: ${files[0]}`
      );
      newFiles = files.slice(1);
      if (newFiles.length) {
        uploadPublicFile(newFiles);
      } else {
        console.log('Finished uploading public files!');
        removeIndexFromPublic();
      }
    }
  );
}

// Recursively creates a subdirectory
function createPublicSubdirectories(subdirectoriesToUpload) {
  let newSubdirectoriesToUpload = subdirectoriesToUpload;
  console.log(`Creating ${newSubdirectoriesToUpload[0]} subdirectory`);
  c.mkdir(`${publicPath}/public/${newSubdirectoriesToUpload[0]}`, err => {
    if (err) {
      console.log(
        `Creating ${
          newSubdirectoriesToUpload[0]
        } subdirectory failed! Error: ${err}`
      );
      throw err;
    }
    newSubdirectoriesToUpload = newSubdirectoriesToUpload.slice(1);
    if (newSubdirectoriesToUpload.length) {
      createPublicSubdirectories(newSubdirectoriesToUpload);
    } else {
      uploadPublicFile(filesToUpload);
    }
  });
}

// Recursively fetches all files in local/public
// Stores all subdirectories for directory creation
function getAllPublicFiles(dir, list) {
  let fileList = list || [];
  fs.readdirSync(dir).forEach(file => {
    if (fs.statSync(`${dir}/${file}`).isDirectory()) {
      const subdirectory = `${dir}/${file}`;
      subdirectories.push(subdirectory.split('/public/')[1]);
      fileList = getAllPublicFiles(`${dir}/${file}`, fileList);
    } else {
      fileList.push(`${dir}/${file}`);
    }
  });
  return fileList;
}

// Creates server/public directory and prepares files to upload
function preparePublicFiles() {
  console.log('Preparing public files to upload');
  c.mkdir('public', () => {
    filesToUpload = getAllPublicFiles(`${__dirname}/public`, null).map(
      dir => dir.split('/public/')[1]
    );
    createPublicSubdirectories(subdirectories);
  });
}

// Creates public folder
function createPublicFolder() {
  console.log('Creating public folder...');
  c.mkdir(`${publicPath}/public`, err => {
    if (err) {
      console.log('Public folder creation failed!');
      throw err;
    }
    console.log('Public folder created!');
    preparePublicFiles();
  });
}

// Turns server/public into a backup folder `/public_backup`
function createPublicFolderBackup() {
  console.log('Backing up public folder...');
  c.rename(`${publicPath}/public`, `${publicPath}/public_backup`, err => {
    if (err) {
      console.log('Public folder backup failed!');
      throw err;
    }
    console.log('Public folder backed up!');
    createPublicFolder();
  });
}

// Removes previous backup of server/public
function startPublicFolderMigration() {
  console.log('Removing previous public folder backup...');
  c.rmdir(`${publicPath}/public_backup`, true, err => {
    if (err) {
      console.log('Removing public folder backup failed!');
    } else {
      console.log('Previous public folder backup successfully removed!');
    }
    createPublicFolderBackup();
  });
}

// Uploads local/public/index.html in blade
function uploadIndexPage() {
  console.log('Uploading index view...');
  c.put(
    `${__dirname}/public/index.html`,
    `${viewPath}/index.blade.php`,
    err => {
      if (err) {
        console.log('Index file upload failed!');
        throw err;
      }
      console.log('Index view uploaded!');
      startPublicFolderMigration();
    }
  );
}

// Appends .backup to index.blade.php file
function startIndexPageMigration() {
  console.log('Backing up index view...');
  c.rename(
    `${viewPath}/index.blade.php`,
    `${viewPath}/index.blade.php.backup`,
    err => {
      if (err) {
        console.log('Index view backup failed!');
        throw err;
      }
      console.log('Index view backed up!');
      uploadIndexPage();
    }
  );
}

c.on('ready', () => {
  console.log(`Uploading from ${__dirname}`);
  console.log(`Uploading to ${publicPath}`);
  startIndexPageMigration();
});

c.connect(config);
// eslint-enable no-console
