/**
 * exportExcel.js
 * 数据导出模块
 * 生成 CSV 文件供 Excel 打开
 */

const Exporter = {
    /**
     * 导出两个数组数据为 CSV
     * @param {string} filename 文件名
     * @param {Array} headers 表头数组 ['时间(s)', '浓度(mol/L)']
     * @param {Array} dataRows 数据行数组 [[t1, c1], [t2, c2]...]
     */
    exportCSV(filename, headers, dataRows) {
        // 添加 BOM 以防止 Excel 中文乱码
        let csvContent = "\uFEFF";
        
        // 添加表头
        csvContent += headers.join(",") + "\n";
        
        // 添加数据
        dataRows.forEach(row => {
            // 处理可能的逗号，虽然数值一般没有
            const processedRow = row.map(val => {
                if (typeof val === 'number') {
                    return val.toFixed(4); // 保留4位小数
                }
                return `"${val}"`;
            });
            csvContent += processedRow.join(",") + "\n";
        });

        // 创建 Blob
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        
        // 创建下载链接
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
};

window.Exporter = Exporter;
