class fileCounterPlugin extends global._basePlugin {
    style = () => {
        const textID = "plugin-file-counter-style";
        const text = `
            .${this.config.CLASS_NAME} {
                display: inline-block;
                float: right;
                white-space: nowrap;
                overflow-x: visible;
                overflow-y: hidden;
                margin-right: 10px;
                padding-left: 3px;
                padding-right: 3px;
                border-radius: 3px;
                background: var(--active-file-bg-color);
                color: var(--active-file-text-color);
                opacity: 1;
            }`;
        return {textID, text}
    }

    init = () => {
        this.Package = this.utils.Package;
    }

    process = () => {
        this.init();

        this.utils.loopDetector(this.setAllDirCount, null, this.config.LOOP_DETECT_INTERVAL);

        new MutationObserver(mutationList => {
            if (mutationList.length === 1) {
                const add = mutationList[0].addedNodes[0];
                if (add && add.classList && add.classList.contains("file-library-node")) {
                    this.setDirCount(add);
                    return
                }
            }

            for (const mutation of mutationList) {
                if (mutation.target && mutation.target.classList && mutation.target.classList.contains(this.config.CLASS_NAME)
                    || mutation.addedNodes[0] && mutation.addedNodes[0].classList && mutation.addedNodes[0].classList.contains(this.config.CLASS_NAME)) {
                    continue
                }
                this.setAllDirCount();
                return
            }
        }).observe(document.getElementById("file-library-tree"), {subtree: true, childList: true});
    }

    verifyExt = filename => {
        if (filename[0] === ".") {
            return false
        }
        const ext = this.Package.Path.extname(filename).replace(/^\./, '');
        if (~this.config.ALLOW_EXT.indexOf(ext.toLowerCase())) {
            return true
        }
    }

    verifySize = (stat) => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE;
    allowRead = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath);

    countFiles = (dir, filter, then) => {
        const Package = this.Package;
        let fileCount = 0;

        async function traverse(dir) {
            const files = await Package.Fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = Package.Path.join(dir, file);
                const stats = await Package.Fs.promises.stat(filePath);
                if (stats.isFile() && filter(filePath, stats)) {
                    fileCount++;
                }
                if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(() => then(fileCount)).catch(err => console.error(err));
    }

    getChild = (ele, className) => {
        for (const child of ele.children) {
            if (child.classList.contains(className)) {
                return child
            }
        }
        return false
    }

    setDirCount = treeNode => {
        const dir = treeNode.getAttribute("data-path");
        this.countFiles(dir, this.allowRead, fileCount => {
            let countDiv = this.getChild(treeNode, this.config.CLASS_NAME);
            if (!countDiv) {
                countDiv = document.createElement("div");
                countDiv.classList.add(this.config.CLASS_NAME);
                const background = treeNode.querySelector(".file-node-background");
                treeNode.insertBefore(countDiv, background.nextElementSibling);
            }
            countDiv.innerText = fileCount + "";
        })

        const children = this.getChild(treeNode, "file-node-children");
        if (children && children.children) {
            children.children.forEach(child => {
                if (child.getAttribute("data-has-sub") === "true") {
                    this.setDirCount(child);
                }
            })
        }
    }

    setAllDirCount = () => {
        const root = document.querySelector("#file-library-tree > .file-library-node");
        if (!root) return false;
        console.log("setAllDirCount");
        this.setDirCount(root);
        return true
    }
}


module.exports = {
    plugin: fileCounterPlugin
};