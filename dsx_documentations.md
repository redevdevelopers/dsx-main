---

# `ChartEditor` Class Documentation

## 1. Overview

The `ChartEditor` class provides a user interface for creating and editing rhythm game charts directly within the application. It features sections for metadata (title, artist, BPM), timing information, and a visual timeline for placing and managing notes. The editor allows users to add different types of notes, manage chart sections, and save their work as a JSON file.

---

## 2. Getting Started

### Import

First, import the `ChartEditor` class into your project.

```javascript
import { ChartEditor } from './scripts/chartEditor.js';
```

### Instantiation and Display

Create a new instance of `ChartEditor` and append its root HTML element to your desired container in the DOM.

```javascript
// Assuming you have a container element in your HTML, e.g., <div id="editor-container"></div>
const editorContainer = document.getElementById('editor-container');

// Create a new ChartEditor instance
const chartEditor = new ChartEditor();

// Append the editor's UI to the container
editorContainer.appendChild(chartEditor.getElement());
```

---

## 3. Constructor

### `new ChartEditor()`

Creates a new `ChartEditor` instance. The constructor initializes a default empty chart structure, renders the editor's UI (including input fields, buttons, and a timeline), and sets up basic event listeners.

---

## 4. Function Reference

### `getElement()`

Retrieves the root HTML element of the `ChartEditor`'s user interface. This element can then be appended to any part of the DOM.

*   **Returns:** `HTMLElement` - The main `div` element containing the entire editor UI.

*   **Example:**
    ```javascript
    const chartEditor = new ChartEditor();
    document.body.appendChild(chartEditor.getElement());
    ```

### Internal Methods (for reference)

The following methods are internal to the `ChartEditor` class and are not intended for direct external use. They are listed here for understanding the class's internal workings.

*   `_render()`: Responsible for generating the editor's HTML structure, embedding initial chart data into input fields, and applying custom CSS styles for the editor's layout and appearance. It also sets up initial event listeners for core UI elements like "Add Note", "Save", and "Close".

*   `_addNote()`: Adds a new, randomly generated note to the internal chart data (`this._chart.notes`). After adding, it triggers a refresh of the timeline display.

*   `_refreshTimeline()`: Clears and re-populates the visual timeline (`#timeline` element) with the current notes from `this._chart.notes`, displaying their time and zone.

*   `_save()`: Gathers the current chart data from `this._chart`, converts it into a JSON string, and triggers a file download for the user. The filename is derived from the chart's title.