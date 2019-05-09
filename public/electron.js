const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const { autoUpdater } = require('electron-updater');
const pdfWindow = require('electron-pdf-window');
const path = require('path');
const argv = require('yargs').parse(process.argv.slice(1));

const http = require('http');
const url = require('url');

const axios = require('axios');
const log = require('electron-log');

const { setMainMenu } = require('./menu');
const protocolName = 'dgview';
const protocolPrefix = `${protocolName}://`;

const apiServer = 'https://bolt.rstat.org/id/get_redirect_data?name=%name%'



// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

log.info('argv', argv)

function extractDeeplinkId(url) {
  log.info('extracting from ' + url)
  if (url && typeof url === 'string') {
    if (url.startsWith(protocolPrefix)) {
      return url.slice(protocolPrefix.length)
    }
  }

}

function navigateToId(id) {
  if (id) {

    axios.get(apiServer.replace('%name%', id))
      .then(res => res.data)
      .then(data => {
        log.info('fetched', data)
        mainWindow.webContents.send("url.requested", data.url);
      })
  }
}

function findDeeplinkId(probes) {
  for (let a of probes) {
    id = extractDeeplinkId(a)
    if (id) {
      return id
    }
  }
}

const initialUrlId = findDeeplinkId(argv._)

function createWindow() {
  const dimensions = electron.screen.getPrimaryDisplay().workArea;
  const w = Math.round(dimensions.width * 0.8)
  const h = Math.round(dimensions.height * 0.8)
  // BrowserWi ndow.addExtension('uBlock0.chromium')
  mainWindow = new BrowserWindow({
    title: 'DGViewer',
    width: w,
    height: h,
    x: dimensions.width - w,
    y: 0,
    autoHideMenuBar: true,
    backgroundColor: '#16171a',
    show: false,
    frame: argv.frameless ? false : true,
    webPreferences: {
      plugins: true
    },
  });
  

  pdfWindow.addSupport(mainWindow);
  const isDev = !!process.env.APP_URL;
  if (process.env.APP_URL) {
    mainWindow.loadURL(process.env.APP_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Show the window once the content has been loaded
  mainWindow.on('ready-to-show', () => {
    // Hide the dock icon before showing and
    // show it once the app has been displayed
    // @link https://github.com/electron/electron/issues/10078
    // @fixme hack to make it show on full-screen windows
    app.dock && app.dock.hide();
    mainWindow.show();
    app.dock && app.dock.show();

    // Set the window to be always on top
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setVisibleOnAllWorkspaces(true);
    mainWindow.setFullScreenable(false);

    bindIpc();

    if (initialUrlId) {
      navigateToId(initialUrlId)
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  mainWindow.on('focus', function () {
    log.debug('main win focus')
    mainWindow.webContents.send('activate')
  });

  mainWindow.on('blur', function () {
    log.debug('main win blur')
    mainWindow.webContents.send('deactivate')
  });

  // Open the dev tools only for dev
  // and when the flag is not set
  if (isDev && !process.env.DEV_TOOLS) {
    mainWindow.webContents.openDevTools();
  }

  setMainMenu(mainWindow);
}

// Binds the methods for renderer/electron communication
function bindIpc() {
  // Binds the opacity getter functionality
  ipcMain.on('opacity.get', (event) => {
    // Multiplying by 100 – browser range is 0 to 100
    event.returnValue = mainWindow.getOpacity() * 100;
  });

  ipcMain.on('opacity.set', (event, opacity) => {
    // Divide by 100 – window range is 0.1 to 1.0
    mainWindow.setOpacity(opacity / 100);
  });
}

// Makes the app start receiving the mouse interactions again
function disableDetachedMode() {
  app.dock && app.dock.setBadge('');
  mainWindow && mainWindow.setIgnoreMouseEvents(false);
}

function checkAndDownloadUpdate() {
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    log.info(e.message);
  }
}

app.on('open-url', function (event, url) {
  event.preventDefault();
  id = extractDeeplinkId(url)
  if (id) {
    navigateToId(id)
  }
});


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {


  app.setAsDefaultProtocolClient(protocolName)


  createWindow();
  checkAndDownloadUpdate();

  var server = http.createServer((request, response) => {
    var targetUrl = url.parse(request.url, true).query.url;
    if (targetUrl) {
      if (Array.isArray(targetUrl)) {
        targetUrl = target_url.pop();
      };
      mainWindow.webContents.send("url.requested", targetUrl);
    };

    response.writeHeader(200);
    response.end();

  })
  server.listen(6280, "0.0.0.0")
});

// Make the window start receiving mouse events on focus/activate
app.on('browser-window-focus', disableDetachedMode);
app.on('activate', disableDetachedMode);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit();
  
});


app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
