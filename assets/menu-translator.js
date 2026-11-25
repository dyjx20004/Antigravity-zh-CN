// Antigravity Chinese Localization Engine - Menu
(function() {
  const menuTranslationMap = {
    "File": "文件",
    "Edit": "编辑",
    "View": "视图",
    "Window": "窗口",
    "Help": "帮助",
    "New Window": "新建窗口",
    "Docs": "使用文档",
    "Toggle Developer Tools": "开发者工具",
    "Check for Updates": "检查更新",
    "Checking for Updates...": "正在检查更新...",
    "Downloading Update...": "正在下载更新...",
    "Restart to Update": "重启以应用更新",
    "Undo": "撤销",
    "Redo": "重做",
    "Cut": "剪切",
    "Copy": "复制",
    "Paste": "粘贴",
    "Select All": "全选",
    "Minimize": "最小化",
    "Close": "关闭",
    "Quit Antigravity": "退出 Antigravity",
    "About Antigravity": "关于 Antigravity",
    "Services": "服务",
    "Hide Antigravity": "隐藏 Antigravity",
    "Hide Others": "隐藏其他",
    "Show All": "显示全部",
    "Force Reload": "强制重新加载",
    "Reload": "重新加载",
    "Actual Size": "实际大小",
    "Zoom In": "放大",
    "Zoom Out": "缩小",
    "Toggle Full Screen": "切换全屏",
    "Toggle Fullscreen": "切换全屏",
    "Reset Zoom": "重置缩放",
    "New Conversation": "新建对话",
    "Create Project": "创建项目",
    "New Project": "新建项目",
    "Create New Project": "创建新项目",
    "Open Project": "打开项目",
    "Command Palette": "命令面板",
    "Split": "分屏",
    "Split Right": "向右分屏",
    "Split Down": "向下分屏",
    "Split Left": "向左分屏",
    "Split Up": "向上分屏",
    "Replace With New": "替换为新建",
    "Replace with New": "替换为新建",
    "Replace with new": "替换为新建",
    "Remove From Split": "从分屏中移除",
    "Split Terminal": "拆分终端",
    "Split Conversation Vertically": "垂直分屏对话",
    "Split Conversation Horizontally": "水平分屏对话",
    "Equalize Split Panes": "均分分屏窗格",
    "Fork": "派生",
    "Fork Conversation": "派生对话",
    "Connect to WSL": "连接到 WSL",
    "Reopen Locally": "本地重新打开",
    "Automations": "自动化",
    "Automation": "自动化",
    "Give Feedback": "提供反馈",
    "Provide Feedback": "提供反馈",
    "Sort By": "排序方式",
    "Sort by": "排序方式",
    "Last Updated": "最近更新",
    "Last Prompt": "最新提示词",
    "Custom Order": "自定义排序",
    "Quote": "引用",
    "Quote Ctrl+L": "引用 Ctrl+L",
    "Quote Cmd+L": "引用 Cmd+L",
    "Conversation Name": "对话名称",
    "Conversation ID": "对话 ID",
    "Project Name": "项目名称",
    "Project Path": "项目路径",
    "Workspace Name": "工作区名称",
    "Workspace Path": "工作区路径",
    "Conversation Path": "对话路径",
    "Ask /btw": "通过 /btw 提问",
    "Connection info…": "连接信息…",
    "Connection info": "连接信息",
    "No agents running": "没有运行中的智能体",
    "Open Antigravity": "打开 Antigravity",
    "Show Antigravity": "显示 Antigravity",
    "Quit": "退出",
    "Selection": "选择",
    "Find": "查找",
    "Docs & API Reference": "文档与 API 参考",
    "Debug Console": "调试控制台",
    "Open Debug Console": "打开调试控制台",
    "Toggle Debug Console": "切换调试控制台",
    "Paste and Match Style": "粘贴并匹配样式",
    "Delete": "删除",
    "Close Window": "关闭窗口",
    "Open Folder": "打开文件夹",
    "New Folder": "新建文件夹",
    "Project Settings": "项目设置",
    "Delete Project": "删除项目",
    "Rename Project": "重命名项目",
    "Remove Project": "移除项目",
    "Remove from List": "从列表中移除",
    "Project options": "项目选项",
    "Copy Project Name": "复制项目名称",
    "Copy Project Path": "复制项目路径",
    "Split Conversation": "拆分对话",
    "Rename": "重命名",
    "Pin": "置顶",
    "Unpin": "取消置顶",
    "Auto Pin": "自动置顶",
    "Mark Unread": "标记为未读",
    "Mark Read": "标记为已读",
    "Mark as Unread": "标记为未读",
    "Mark as Read": "标记为已读",
    "Stop": "停止",
    "Stop Agent": "停止智能体",
    "Resume": "恢复",
    "Restart": "重启",
    "Close Others": "关闭其他",
    "Close All": "全部关闭",
    "Copy Path": "复制路径",
    "Copy Relative Path": "复制相对路径",
    "Reveal in File Explorer": "在文件资源管理器中显示",
    "Reveal in Finder": "在访达中显示",
    "Open in Terminal": "在终端中打开",
    "View Usage": "查看使用额度",
    "Duplicate": "创建副本",
    "Archive": "归档",
    "Archive Conversation": "归档对话",
    "Unarchive": "取消归档",
    "Unarchive Conversation": "取消归档对话",
    "Share": "分享",
    "Copy Link": "复制链接",
    "Export": "导出",
    "Export Conversation": "导出对话",
    "Clear": "清除",
    "Clear History": "清除历史"
  };

  const dialogTextMap = {
    'Confirm Quit': '确认退出',
    'Are you sure you want to quit?': '您确定要退出吗？',
    'There may be agents or background tasks running.': '可能还有智能体或后台任务正在运行。',
    'Check for Updates': '检查更新',
    'No updates available': '当前已是最新版本',
    'Open workspace': '打开工作区',
    'Open workspaces': '打开多个工作区',
    'Select Download Folder': '选择下载文件夹',
    'Cannot open folder': '无法打开文件夹',
    'Folder is on the Windows filesystem': '文件夹位于 Windows 文件系统',
    'WSL distro not found': '未找到 WSL 发行版',
    'Antigravity opened on Windows instead.': 'Antigravity 已改为在 Windows 本地打开。',
    'WSL setup failed': 'WSL 配置失败',
    'Binary not found': '未找到程序组件',
    'Startup failed': '启动失败',
    'Connect a device': '连接设备',
    'Choose a Passkey': '选择通行密钥',
    'Select a passkey account to continue:': '请选择一个通行密钥账号以继续：',
    'Connection info': '连接信息',
    'This page': '当前页面',
    'OK': '确定',
    'Cancel': '取消',
    'Quit': '退出',
    'Yes': '是',
    'No': '否',
    'Continue': '继续'
  };

  globalThis.__agyMenuZhMap = menuTranslationMap;

  function translateLabel(label) {
    if (typeof label !== 'string' || !label) return label;
    if (Object.prototype.hasOwnProperty.call(menuTranslationMap, label)) {
      return menuTranslationMap[label];
    }
    const trimmed = label.trim();
    if (Object.prototype.hasOwnProperty.call(menuTranslationMap, trimmed)) {
      return menuTranslationMap[trimmed];
    }
    let m = label.match(/^(\d+)\s+agents?\s+running$/i);
    if (m) {
      return `${m[1]} 个智能体运行中`;
    }
    m = label.match(/^Open\s+(.+)$/);
    if (m) {
      return `打开 ${m[1]}`;
    }
    return label;
  }

  function translateMenu(menuItem) {
    if (!menuItem || typeof menuItem !== 'object') return;
    if (menuItem.label) {
      menuItem.label = translateLabel(menuItem.label);
    }
    if (menuItem.submenu) {
      if (Array.isArray(menuItem.submenu.items)) {
        menuItem.submenu.items.forEach(translateMenu);
      } else if (Array.isArray(menuItem.submenu)) {
        menuItem.submenu.forEach(translateMenu);
      }
    }
  }

  function translateDialogText(str) {
    if (typeof str !== 'string' || !str) return str;
    if (Object.prototype.hasOwnProperty.call(dialogTextMap, str)) {
      return dialogTextMap[str];
    }
    let m = str.match(/^The WSL distro "(.+)" is no longer installed\.$/);
    if (m) {
      return `WSL 发行版 "${m[1]}" 已不再安装。`;
    }
    m = str.match(/^Sign in to (.+)$/);
    if (m) {
      return `登录到 ${m[1]}`;
    }
    m = str.match(/^SSH:\s*(.+)$/);
    if (m) {
      return `SSH：${m[1]}`;
    }
    m = str.match(/^Failed to install the server into WSL distro "(.+)":\n([\s\S]*)$/);
    if (m) {
      return `无法将服务端安装到 WSL 发行版 "${m[1]}"：\n${m[2]}`;
    }
    return str;
  }

  function translateDialogOptions(opts) {
    if (!opts || typeof opts !== 'object') return opts;
    const cloned = Object.assign({}, opts);
    if (typeof cloned.title === 'string') {
      cloned.title = translateDialogText(cloned.title);
    }
    if (typeof cloned.message === 'string') {
      cloned.message = translateDialogText(cloned.message);
    }
    if (typeof cloned.detail === 'string') {
      cloned.detail = translateDialogText(cloned.detail);
    }
    if (typeof cloned.buttonLabel === 'string') {
      cloned.buttonLabel = translateDialogText(cloned.buttonLabel);
    }
    if (Array.isArray(cloned.buttons)) {
      cloned.buttons = cloned.buttons.map((b) => (typeof b === 'string' ? translateDialogText(b) : b));
    }
    return cloned;
  }

  function wrapDialogCall(origFn) {
    return function(...args) {
      if (args.length >= 2 && args[1] && typeof args[1] === 'object') {
        args[1] = translateDialogOptions(args[1]);
      } else if (args.length >= 1 && args[0] && typeof args[0] === 'object') {
        args[0] = translateDialogOptions(args[0]);
      }
      return origFn.apply(this, args);
    };
  }

  try {
    const { Menu, dialog } = require('electron');
    if (Menu && Menu.buildFromTemplate && !Menu.__isTranslated) {
      const originalBuildFromTemplate = Menu.buildFromTemplate.bind(Menu);
      Menu.buildFromTemplate = function(template) {
        if (Array.isArray(template)) {
          template.forEach(translateMenu);
        }
        return originalBuildFromTemplate(template);
      };
      if (Menu.setApplicationMenu) {
        const originalSetApplicationMenu = Menu.setApplicationMenu.bind(Menu);
        Menu.setApplicationMenu = function(menu) {
          if (menu && Array.isArray(menu.items)) {
            menu.items.forEach(translateMenu);
          }
          return originalSetApplicationMenu(menu);
        };
      }
      Menu.__isTranslated = true;
    }

    if (dialog && !dialog.__isTranslated) {
      if (typeof dialog.showMessageBox === 'function') {
        dialog.showMessageBox = wrapDialogCall(dialog.showMessageBox.bind(dialog));
      }
      if (typeof dialog.showMessageBoxSync === 'function') {
        dialog.showMessageBoxSync = wrapDialogCall(dialog.showMessageBoxSync.bind(dialog));
      }
      if (typeof dialog.showOpenDialog === 'function') {
        dialog.showOpenDialog = wrapDialogCall(dialog.showOpenDialog.bind(dialog));
      }
      if (typeof dialog.showSaveDialog === 'function') {
        dialog.showSaveDialog = wrapDialogCall(dialog.showSaveDialog.bind(dialog));
      }
      if (typeof dialog.showErrorBox === 'function') {
        const origErrorBox = dialog.showErrorBox.bind(dialog);
        dialog.showErrorBox = function(title, content) {
          return origErrorBox(translateDialogText(title), translateDialogText(content));
        };
      }
      dialog.__isTranslated = true;
    }
  } catch (e) {
    console.error('Menu/Dialog hooking failed:', e);
  }
})();
