const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveChart: (chartData) => ipcRenderer.invoke('save-chart', chartData),
    getSavedCharts: () => ipcRenderer.invoke('get-saved-charts'),
    // Add other IPC functions here as needed
});