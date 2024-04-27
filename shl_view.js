/**
 * Convert number to a string with a unit, while showing at least precision digits.
 * 123, 2 -> 123
 * 123456, 2 -> 123k (not 0.123M)
 * 123456, 4 -> 123.5k
 * -123, 2 -> -123
 * 
 * @param {number} n number to format
 * @param {number} precision number of digits that needs to be represented
 * @returns 
 */
const toSINumber = (n, precision) => {
    if (Math.abs(n) < 1) {
        return n.toFixed(precision);
    }

    const units = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];
    const sign = n > 0;
    n = Math.abs(n);

    const unitIndex = Math.min(Math.floor(Math.log10(n) / 3), units.length - 1);
    const mantissa = n / (10 ** (unitIndex * 3)); // must be in [1, 1000)
    const precAfterDot = Math.max(0, precision - Math.floor(Math.log10(mantissa)) - 1);

    return `${sign ? "" : "-"}${mantissa.toFixed(precAfterDot)}${units[unitIndex]}`;
};


const WORLD_SIZE = 1024;

// A window into ECA spacetime.
class ECAView {
    constructor() {
        this.$el = $("#eca");
        this.stb = null;

        // p<canvas> = p<ECA> * zoom + t
        this.zoom = 3;
        this.tx = $('#col_eca').width() / 2;
        this.ty = 0;

        // setupGUI
        // adjust canvas size
        this.canvasWidth = $('#col_eca').width();
        this.canvasHeight = $(window).height() - 150;
        this.$el[0].width = this.canvasWidth;
        this.$el[0].height = this.canvasHeight;

        this.bufferCanvas = new OffscreenCanvas(WORLD_SIZE, WORLD_SIZE);

        this.$el.on('mousewheel', event => {
            event.preventDefault();

            // p = event.offsetX,Y must be preserved.
            // p<canvas> = p<ECA> * zoom + t = p<ECA> * new_zoom + new_t

            const centerXECA = (event.offsetX - this.tx) / this.zoom;
            const centerYECA = (event.offsetY - this.ty) / this.zoom;
            this.zoom = Math.min(10, Math.max(1e-12, this.zoom * (1 + event.deltaY * 0.1)));

            this.tx = event.offsetX - centerXECA * this.zoom;
            this.ty = event.offsetY - centerYECA * this.zoom;
        });

        let dragging = false;
        let prevEv = null;
        this.$el.on('mousedown', () => {
            dragging = true;
        });

        this.$el.on('mouseleave', () => {
            dragging = false;
            prevEv = null;
        });

        this.$el.on('mouseup', () => {
            dragging = false;
            prevEv = null;
        });

        this.$el.on('mousemove', event => {
            if (!dragging) {
                return;
            }

            if (prevEv !== null) {
                this.tx += event.clientX - prevEv.clientX;
                this.ty += event.clientY - prevEv.clientY;
            }
            prevEv = event;
        });

        this._run();
    }

    /** Sets new STBlocks */
    updateSTB(stb) {
        this.stb = stb;
    }

    _redraw() {
        if (this.stb === null) {
            setTimeout(() => {
                this._redraw();
            }, 100);
            return;
        }

        const ctx = this.$el[0].getContext('2d');

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.rect(0, 0, this.$el[0].width, this.$el[0].height);
        ctx.fill();

        // Draw ECA.
        const tr = new Timeout(0.1);
        ctx.save();
        ctx.translate(this.tx, this.ty);
        ctx.scale(this.zoom, this.zoom);
        const bufferOffset = this._updateOffscreenBuffer(0.05);
        ctx.imageSmoothingEnabled = this.zoom < 4;
        ctx.drawImage(this.bufferCanvas, 0, 0); //, bufferOffset.x0, bufferOffset.y0, bufferOffset.w, bufferOffset.h);
        ctx.restore();

        // Draw ruler (10x10 - 10x100)
        const exponent = Math.floor(Math.log10(this.zoom));
        const fraction = this.zoom / Math.pow(10, exponent);

        ctx.save();
        ctx.translate(0, this.$el[0].height - 20);
        ctx.beginPath();
        ctx.rect(0, 0, 300, 20);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(fraction * 10, 15);
        ctx.strokeStyle = '#020F80';
        ctx.stroke();

        const win = this._getWindow();
        ctx.fillStyle = '#020F80';
        const xrange = `x:[${toSINumber(win.x0, 4)},${toSINumber(win.x1, 4)}]`;
        const yrange = `y:[${toSINumber(win.y0, 4)},${toSINumber(win.y1, 4)}]`;
        ctx.fillText(`${toSINumber(10 * Math.pow(10, -exponent), 1)}   ${xrange} ${yrange}`, 0, 10);
        ctx.restore();

        setTimeout(() => {
            this._redraw();
        }, 100);
    }

    _run() {
        this._redraw();
    }

    /**
     * @returns {object} {x0:number, y0:number, w:number, h:number} Rectangle in ECA coordinates where offscreenBuffer should be drawn.
     */
    _updateOffscreenBuffer(timeoutSec) {
        const worldImage = new ImageData(WORLD_SIZE, WORLD_SIZE);
        for (let y = 0; y < WORLD_SIZE; y++) {
            for (let x = 0; x < WORLD_SIZE; x++) {
                const cell = Math.random() > 0.5;
                worldImage.data[(x + WORLD_SIZE * y) * 4 + 0] = cell ? 80 : 255;
                worldImage.data[(x + WORLD_SIZE * y) * 4 + 1] = cell ? 80 : 255;
                worldImage.data[(x + WORLD_SIZE * y) * 4 + 2] = cell ? 80 : 255;
                worldImage.data[(x + WORLD_SIZE * y) * 4 + 3] = 255;
            }
        }

        // render
        const ctxBuf = this.bufferCanvas.getContext("2d");
        ctxBuf.putImageData(worldImage, 0, 0);
    }

    /**
     * Get current visible area of ECA, in ECA coordinates (x, t == y).
     * @returns {object} {x0, x1, y0, y1}
     */
    _getWindow() {
        // p<canvas> = p<ECA> * zoom + t
        // p<ECA> = (p<canvas> - t) / zoom
        return {
            x0: (-this.tx) / this.zoom,
            x1: (this.canvasWidth - this.tx) / this.zoom,
            y0: Math.max(0, (-this.ty) / this.zoom),
            y1: (this.canvasHeight - this.ty) / this.zoom,
        };
    }
}
