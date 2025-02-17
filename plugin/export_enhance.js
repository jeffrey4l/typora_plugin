class exportEnhancePlugin extends global._basePlugin {
    init = () => {
        this.Path = this.utils.Package.Path;
        this.tempFolder = this.utils.tempFolder; // i‘d like to shit here
        this.regexp = new RegExp(`<img.*?src="(.*?)".*?>`, "gs");
    }

    process = () => {
        this.init();
        this.utils.decorate(
            () => (File && File.editor && File.editor.export && File.editor.export.exportToHTML),
            "File.editor.export.exportToHTML",
            null,
            this.afterExportToHtml,
            true,
        );
    }

    afterExportToHtml = async (exportResult, ...args) => {
        if (!this.config.ENABLE) return exportResult;
        const exportConfig = args[0];
        if (!exportConfig || exportConfig["type"] !== "html" && exportConfig["type"] !== "html-plain") return exportResult;

        const html = await exportResult;
        const writeIdx = html.indexOf(`id='write'`);
        if (writeIdx === -1) return this.simplePromise(html);

        const imageMap = (this.config.DOWNLOAD_NETWORK_IMAGE) ? await this.downloadAllImage(html, writeIdx) : {};

        const dirname = this.getCurDir();
        const newHtml = html.replace(this.regexp, (origin, src, srcIdx) => {
            if (srcIdx < writeIdx) return origin;

            let result = origin;
            let imagePath;
            try {
                if (this.utils.isNetworkImage(src)) {
                    if (!this.config.DOWNLOAD_NETWORK_IMAGE || !imageMap.hasOwnProperty(src)) return origin

                    const path = imageMap[src];
                    imagePath = this.Path.join(this.tempFolder, path);
                } else {
                    imagePath = this.Path.join(dirname, src);
                }
                const base64Data = this.toBase64(imagePath);
                result = origin.replace(src, base64Data);
            } catch (e) {
                console.error("export error:", e);
            }
            return result;
        })
        return this.simplePromise(newHtml);
    }

    downloadAllImage = async (html, writeIdx) => {
        const imageMap = {} // map src to localFileName, use for network image only
        for (let result of html.matchAll(this.regexp)) {
            if (result.length !== 2 || result.index < writeIdx || !this.utils.isNetworkImage(result[1])) continue
            const src = result[1];
            if (!imageMap.hasOwnProperty(src)) { // single flight
                const filename = Math.random() + "_" + this.Path.basename(src);
                const {state} = await JSBridge.invoke("app.download", src, this.tempFolder, filename);
                if (state === "completed") {
                    imageMap[src] = filename;
                }
            }
        }
        return this.simplePromise(imageMap)
    }

    getCurDir = () => {
        const filepath = this.utils.getFilePath();
        return this.Path.dirname(filepath)
    }

    toBase64 = imagePath => {
        const bitmap = this.utils.Package.Fs.readFileSync(imagePath);
        const data = Buffer.from(bitmap).toString('base64');
        return `data:image;base64,${data}`;
    }

    simplePromise = result => new Promise(resolve => resolve(result));

    dynamicCallArgsGenerator = () => {
        const call_args = [];
        if (this.config.DOWNLOAD_NETWORK_IMAGE) {
            call_args.push({arg_name: "导出HTML时不下载网络图片", arg_value: "dont_download_network_image"});
        } else {
            call_args.push({arg_name: "导出HTML时下载网络图片", arg_value: "download_network_image"});
        }
        if (this.config.ENABLE) {
            call_args.push({arg_name: "禁用", arg_value: "disable"});
        } else {
            call_args.push({arg_name: "启用", arg_value: "enable"})
        }

        return call_args
    }

    call = type => {
        if (type === "download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = true
        } else if (type === "dont_download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = false
        } else if (type === "disable") {
            this.config.ENABLE = false
        } else if (type === "enable") {
            this.config.ENABLE = true
        }
    }
}

module.exports = {
    plugin: exportEnhancePlugin
};