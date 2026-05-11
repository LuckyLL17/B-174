/**
 * visualization.js
 * 轻量级 Canvas 图表库 (无依赖)
 * 用于绘制各类工程曲线
 */

class ChartRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.padding = { top: 30, right: 30, bottom: 40, left: 50 };
        this.colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2'];
        
        // Handle resizing
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Use parent container size
        const parent = this.canvas.parentElement;
        const rect = parent.getBoundingClientRect();
        
        // High-DPI Support
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual size in memory (scaled to account for extra pixel density)
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // Set visible size (css pixels)
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        
        // Normalize coordinate system to use css pixels
        this.ctx.scale(dpr, dpr);

        // Store logical width/height for calculations
        this.width = rect.width;
        this.height = rect.height;
        
        // Redraw if data exists (user needs to trigger this or logic needs to handle)
        // For now, logic relies on external call to render
    }

    /**
     * 绘制折线图
     * @param {Object} data - { 
     *   labels: number[], // X轴数据
     *   datasets: [{ label: string, data: number[], color: string }]
     * }
     * @param {Object} options - { title: string, xLabel: string, yLabel: string }
     */
    render_line_chart(data, options = {}) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (!data.labels || data.labels.length === 0) return;

        const { minX, maxX, minY, maxY } = this.calculateBounds(data);
        
        // 绘制坐标轴
        this.drawAxes(minX, maxX, minY, maxY, options);
        
        // 绘制数据线
        data.datasets.forEach((dataset, index) => {
            const color = dataset.color || this.colors[index % this.colors.length];
            this.drawLine(data.labels, dataset.data, minX, maxX, minY, maxY, color);
        });

        // 绘制图例
        this.drawLegend(data.datasets);
    }

    calculateBounds(data) {
        let minX = Math.min(...data.labels);
        let maxX = Math.max(...data.labels);
        
        let allY = [];
        data.datasets.forEach(d => allY.push(...d.data));
        let minY = Math.min(...allY);
        let maxY = Math.max(...allY);

        // Add some padding
        const yRange = maxY - minY;
        if (yRange === 0) {
            minY -= 1;
            maxY += 1;
        } else {
            minY -= yRange * 0.1;
            maxY += yRange * 0.1;
        }

        return { minX, maxX, minY, maxY };
    }

    mapX(val, minX, maxX) {
        const plotWidth = this.width - this.padding.left - this.padding.right;
        return this.padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
    }

    mapY(val, minY, maxY) {
        const plotHeight = this.height - this.padding.top - this.padding.bottom;
        // Y axis follows computer graphics (0 at top), so we invert
        return this.height - this.padding.bottom - ((val - minY) / (maxY - minY)) * plotHeight;
    }

    drawAxes(minX, maxX, minY, maxY, options) {
        const ctx = this.ctx;
        const originX = this.padding.left;
        const originY = this.height - this.padding.bottom;
        const topY = this.padding.top;
        const rightX = this.width - this.padding.right;

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Y Axis
        ctx.moveTo(originX, topY);
        ctx.lineTo(originX, originY);
        // X Axis
        ctx.lineTo(rightX, originY);
        ctx.stroke();

        // Grid lines (Simple)
        ctx.strokeStyle = '#eee';
        ctx.setLineDash([5, 5]);
        
        // Horizontal Grids (5 lines)
        for (let i = 0; i <= 5; i++) {
            const val = minY + (maxY - minY) * (i / 5);
            const y = this.mapY(val, minY, maxY);
            ctx.beginPath();
            ctx.moveTo(originX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();
            
            // Labels
            ctx.fillStyle = '#666';
            ctx.textAlign = 'right';
            ctx.fillText(val.toPrecision(3), originX - 5, y + 4);
        }

        // Vertical Grids (5 lines)
        for (let i = 0; i <= 5; i++) {
            const val = minX + (maxX - minX) * (i / 5);
            const x = this.mapX(val, minX, maxX);
            
            // Labels
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(val.toPrecision(3), x, originY + 15);
        }
        ctx.setLineDash([]);

        // Axis Titles
        if (options.xLabel) {
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(options.xLabel, (originX + rightX) / 2, this.height - 5);
        }
        if (options.yLabel) {
            ctx.save();
            ctx.translate(15, (topY + originY) / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText(options.yLabel, 0, 0);
            ctx.restore();
        }
        
        // Main Title
        if (options.title) {
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(options.title, this.width / 2, 20);
        }
    }

    drawLine(labels, data, minX, maxX, minY, maxY, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        for (let i = 0; i < labels.length; i++) {
            const x = this.mapX(labels[i], minX, maxX);
            const y = this.mapY(data[i], minY, maxY);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    drawLegend(datasets) {
        const ctx = this.ctx;
        let startX = this.width - this.padding.right - 100;
        let startY = this.padding.top;
        
        datasets.forEach((d, i) => {
            const color = d.color || this.colors[i % this.colors.length];
            
            ctx.fillStyle = color;
            ctx.fillRect(startX, startY + i * 20, 10, 10);
            
            ctx.fillStyle = '#333';
            ctx.textAlign = 'left';
            ctx.font = '10px sans-serif';
            ctx.fillText(d.label, startX + 15, startY + i * 20 + 9);
        });
    }

    render_bar_chart(data, options = {}) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (!data.labels || data.labels.length === 0) return;

        let allValues = [];
        data.datasets.forEach(d => allValues.push(...d.data));
        let maxY = Math.max(...allValues);
        let minY = 0;
        
        const yRange = maxY - minY;
        if (yRange === 0) maxY = 1;
        maxY += yRange * 0.1;

        this.drawBarAxes(minY, maxY, options);

        const numBars = data.labels.length;
        const barWidth = (this.width - this.padding.left - this.padding.right) / numBars * 0.6;
        const gap = (this.width - this.padding.left - this.padding.right) / numBars * 0.2;

        data.datasets.forEach((dataset, di) => {
            const color = dataset.color || this.colors[di % this.colors.length];
            dataset.data.forEach((value, i) => {
                const x = this.padding.left + gap / 2 + i * (barWidth + gap);
                const y = this.mapY(value, minY, maxY);
                const height = this.height - this.padding.bottom - y;
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x, y, barWidth, height);
                
                this.ctx.fillStyle = '#333';
                this.ctx.textAlign = 'center';
                this.ctx.font = '10px sans-serif';
                this.ctx.fillText(value.toFixed(3), x + barWidth / 2, y - 5);
            });
        });

        if (options.title) {
            this.ctx.fillStyle = '#333';
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.fillText(options.title, this.width / 2, 20);
        }
    }

    drawBarAxes(minY, maxY, options) {
        const ctx = this.ctx;
        const originX = this.padding.left;
        const originY = this.height - this.padding.bottom;
        const topY = this.padding.top;
        const rightX = this.width - this.padding.right;

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX, topY);
        ctx.lineTo(originX, originY);
        ctx.lineTo(rightX, originY);
        ctx.stroke();

        ctx.strokeStyle = '#eee';
        ctx.setLineDash([5, 5]);
        for (let i = 0; i <= 5; i++) {
            const val = minY + (maxY - minY) * (i / 5);
            const y = this.mapY(val, minY, maxY);
            ctx.beginPath();
            ctx.moveTo(originX, y);
            ctx.lineTo(rightX, y);
            ctx.stroke();
            
            ctx.fillStyle = '#666';
            ctx.textAlign = 'right';
            ctx.fillText(val.toPrecision(3), originX - 5, y + 4);
        }
        ctx.setLineDash([]);

        if (options.labels) {
            const numLabels = options.labels.length;
            const barWidth = (this.width - this.padding.left - this.padding.right) / numLabels;
            options.labels.forEach((label, i) => {
                const x = this.padding.left + barWidth * (i + 0.5);
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.save();
                ctx.translate(x, originY + 10);
                ctx.rotate(-Math.PI / 4);
                ctx.font = '9px sans-serif';
                ctx.fillText(label, 0, 0);
                ctx.restore();
            });
        }
    }

    render_scatter_chart(data, options = {}) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (!data.datasets || data.datasets.length === 0) return;

        let allX = [], allY = [];
        data.datasets.forEach(d => {
            d.data.forEach(p => {
                allX.push(p.x);
                allY.push(p.y);
            });
        });

        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);

        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;

        this.drawAxes(minX - xRange * 0.1, maxX + xRange * 0.1, minY - yRange * 0.1, maxY + yRange * 0.1, options);

        data.datasets.forEach((dataset, di) => {
            const color = dataset.color || this.colors[di % this.colors.length];
            this.ctx.fillStyle = color;
            dataset.data.forEach(p => {
                const x = this.mapX(p.x, minX - xRange * 0.1, maxX + xRange * 0.1);
                const y = this.mapY(p.y, minY - yRange * 0.1, maxY + yRange * 0.1);
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, Math.PI * 2);
                this.ctx.fill();
            });
        });
    }
}

// 供全局使用
window.ChartRenderer = ChartRenderer;
