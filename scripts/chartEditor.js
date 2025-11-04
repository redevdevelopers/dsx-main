import { ChartData } from './chartData.js';

export class ChartEditor {
    constructor() {
        this._el = document.createElement('div');
        this._el.classList.add('panel');
        this._chart = {
            meta: {
                title: 'untitled',
                artist: '',
                creator: '',
                difficulty: 1,
                difficultyName: 'NORMAL',
                bpm: {
                    init: 120,
                    min: 120,
                    max: 120
                },
                preview: {
                    start: 0,
                    duration: 15000
                },
                version: '1.0.0'
            },
            timing: {
                offset: 0,
                bpmChanges: [{ time: 0, bpm: 120 }],
                timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }]
            },
            sections: [],
            notes: []
        };
        this._currentSection = null;
        this._chartData = new ChartData(this._chart);
        this._render();
    }

    _render() {
        this._el.innerHTML = `
      <div class="menu-title">Chart Editor</div>
      <div class="editor-container">
        <div class="editor-sidebar">
          <div class="editor-section">
            <h3>Metadata</h3>
            <div class="field-row">
              <label>Title: <input id="title" value="${this._chart.meta.title}"></label>
            </div>
            <div class="field-row">
              <label>Artist: <input id="artist" value="${this._chart.meta.artist}"></label>
            </div>
            <div class="field-row">
              <label>Creator: <input id="creator" value="${this._chart.meta.creator}"></label>
            </div>
            <div class="field-row">
              <label>Difficulty: 
                <select id="difficulty-name">
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HARD">HARD</option>
                  <option value="EXPERT">EXPERT</option>
                  <option value="MAXIMUM">MAXIMUM</option>
                </select>
                <input type="number" id="difficulty" value="${this._chart.meta.difficulty}" min="1" max="15" style="width:60px">
              </label>
            </div>
          </div>

          <div class="editor-section">
            <h3>Timing</h3>
            <div class="field-row">
              <label>Initial BPM: <input type="number" id="bpm" value="${this._chart.meta.bpm.init}" style="width:80px"></label>
            </div>
            <div class="field-row">
              <label>Offset (ms): <input type="number" id="offset" value="${this._chart.timing.offset}" style="width:80px"></label>
            </div>
            <button class="button ghost" id="add-bpm">Add BPM Change</button>
          </div>

          <div class="editor-section">
            <h3>Sections</h3>
            <div id="sections-list"></div>
            <button class="button ghost" id="add-section">Add Section</button>
          </div>
        </div>

        <div class="editor-main">
          <div class="editor-toolbar">
            <button class="button" id="add-note">Add Note</button>
            <select id="note-type">
              <option value="regular">Regular</option>
              <option value="hold">Hold Note</option>
              <option value="chain">Chain Note</option>
              <option value="multi">Multi Note</option>
            </select>
            <button class="button ghost" id="save">Save</button>
            <button class="button ghost" id="test">Test Play</button>
            <button class="button ghost" id="close">Close</button>
          </div>
          
          <div class="timeline-container">
            <div id="timeline-rulers"></div>
            <div class="timeline" id="timeline"></div>
          </div>

          <div class="editor-stats">
            <div>Total Notes: <span id="total-notes">0</span></div>
            <div>Duration: <span id="duration">0:00</span></div>
            <div>Calculated Difficulty: <span id="calc-difficulty">0</span></div>
          </div>
        </div>
      </div>
    `;

        // Add custom styles for the editor
        const style = document.createElement('style');
        style.textContent = `
      .editor-container {
        display: flex;
        gap: 16px;
        margin-top: 12px;
      }
      .editor-sidebar {
        width: 280px;
        flex-shrink: 0;
      }
      .editor-main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
      }
      .editor-section {
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .editor-section h3 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--accent);
      }
      .field-row {
        margin-bottom: 8px;
      }
      .field-row label {
        display: block;
        font-size: 13px;
        margin-bottom: 4px;
      }
      .field-row input, .field-row select {
        width: 100%;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .timeline-container {
        background: rgba(0,0,0,0.2);
        border-radius: 8px;
        padding: 12px;
        margin: 12px 0;
        height: 400px;
        overflow-y: auto;
      }
      .editor-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .editor-stats {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: var(--muted);
      }
      #timeline-rulers {
        height: 24px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 8px;
      }
    `;
        this._el.appendChild(style);
        this._el.querySelector('#add-note').addEventListener('click', () => this._addNote());
        this._el.querySelector('#save').addEventListener('click', () => this._save());
        this._el.querySelector('#close').addEventListener('click', () => this._el.remove());
    }

    _addNote() {
        const t = (this._chart.notes.length + 1) * 1000;
        const zone = Math.floor(Math.random() * 6);
        this._chart.notes.push({ time: t, zone });
        this._refreshTimeline();
    }

    _refreshTimeline() {
        const el = this._el.querySelector('#timeline');
        el.innerHTML = '';
        this._chart.notes.forEach((n, i) => {
            const d = document.createElement('div');
            d.style.padding = '6px'; d.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            d.textContent = `${i + 1}: time=${n.time}ms zone=${n.zone}`;
            el.appendChild(d);
        });
    }

    _save() {
        const filename = (this._el.querySelector('#title').value || 'chart') + '.json';
        const blob = new Blob([JSON.stringify(this._chart, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    getElement() { return this._el; }
}
