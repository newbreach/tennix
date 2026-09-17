import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface MiniProgramTipProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MiniProgramTip: React.FC<MiniProgramTipProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://your-domain.com';

  const wxmlSnippet = `<!-- 微信小程序 pages/tennis/tennis.wxml -->
<web-view 
  src="${currentUrl}" 
  bindmessage="onWebviewMessage"
/>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(wxmlSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      id="modal-wechat-guide"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 md:p-6 max-w-lg w-full shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">微信小程序嵌入指南</h3>
              <p className="text-[11px] text-slate-400">已全面优化适配 &lt;web-view&gt; 容器</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 text-sm rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* WeChat Optimizations checklist */}
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs space-y-1.5 text-emerald-200">
          <div className="font-bold text-emerald-300">✅ 本页面已针对微信小程序内置优化：</div>
          <p>• <strong>禁止橡皮筋回弹</strong>：防止在微信内滑动时触发下拉刷新或页面跳动。</p>
          <p>• <strong>Safe-Area 齐刘海适配</strong>：顶部与底部自适应微信小程序原生返回键与操作区。</p>
          <p>• <strong>Web Audio 无延迟合成音效</strong>：无需外部静态音效文件，微信内静音/播放零网络依赖。</p>
          <p>• <strong>高刷全屏 Canvas</strong>：根据移动端 Retina 屏幕动态计算 DPR，保证画面极其细腻流畅。</p>
        </div>

        {/* Step 1: WXML Code */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300">1. 小程序 WXML 代码：</span>
            <button
              onClick={copySnippet}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? '已复制' : '复制代码'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
            {wxmlSnippet}
          </pre>
        </div>

        {/* Step 2: Domain config */}
        <div className="text-xs space-y-2 text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <ExternalLink size={14} className="text-amber-400" />
            <span>2. 微信公众平台配置（发布前须知）：</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
            <li>
              登录 <span className="text-blue-400">微信公众平台 (mp.weixin.qq.com)</span> &gt; 开发管理 &gt; 开发设置 &gt; <strong>业务域名</strong>。
            </li>
            <li>
              将部署后的独立域名添加至业务域名白名单，并上传校验文件（微信小程序 web-view 必须为合法 HTTPS 域名）。
            </li>
            <li>
              本地测试时：微信开发者工具勾选 <strong>“不校验合法域名、web-view（业务域名）”</strong> 即可直接预览调试！
            </li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          我知道了，继续体验游戏
        </button>
      </div>
    </div>
  );
};
