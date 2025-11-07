const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron'); // Added shell for opening external links
const path = require('path');
const fs = require('fs').promises; // Added fs.promises for async file operations

function createWindow() {
    const win = new BrowserWindow({
        width: 1366,
        height: 768,
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true, // Disable Node.js integration
            contextIsolation: true, // Important for security
            enableRemoteModule: false // Disable remote module
        },
        autoHideMenuBar: true,  // Ribbon bar hidden only accessible through ALT key.
    });

    win.loadFile('index.html');

    // Custom menu template
    const template = [
        {
            label: 'DreamSync Version',
            submenu: [
                {
                    label: `Version`,
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'DreamSync Version',
                            message: `Build 7/11/2025. DSX V1.12-D`,
                            buttons: ['OK']
                        });
                    }
                }
            ]
        },
        {
            label: 'Developer Tools',
            submenu: [
                {
                    label: 'Open DevTools',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.openDevTools({ mode: 'detach' });
                        }
                    }
                },
                {
                    label: 'Inspect Element',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.inspectElement(0, 0);
                        }
                    }
                },
                {
                    label: 'Force Reload',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.reloadIgnoringCache();
                        }
                    }
                }
            ]
        },
        {
            label: 'Client Options',
            submenu: [
                {
                    label: 'Reload/Restart App',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.reload();  // Reloads the current window
                        }
                    }
                },
                {
                    label: 'Full Screen',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.setFullScreen(!window.isFullScreen());  // Toggle full-screen mode
                        }
                    }
                }
            ]
        },
        {
            label: 'Need Help?',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        shell.openExternal('https://your-app-documentation-url.com');
                    }
                }
            ]
        }
    ];

    // Set the menu
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}


app.whenReady().then(() => {
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8096'); // 4GB limit, adjust accordingly
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
