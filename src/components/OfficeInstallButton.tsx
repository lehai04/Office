import { Download, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
}

export function OfficeInstallButton() {
  const displayMode = useRef(window.matchMedia('(display-mode: standalone)'));
  const [installed, setInstalled] = useState(
    () => displayMode.current.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const mode = displayMode.current;
    const onModeChange = (event: MediaQueryListEvent) => setInstalled(event.matches);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    mode.addEventListener('change', onModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mode.removeEventListener('change', onModeChange);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      setPrompt(null);
      try {
        await prompt.prompt();
        return;
      } catch {
        // The browser can invalidate an install prompt before it is used.
      }
    }
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={() => void install()} title="Cài Office" aria-label="Cài Office"
        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-violet-200 hover:bg-slate-800">
        <Download className="size-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">Cài Office</span>
      </button>
      <dialog ref={dialog} aria-labelledby="office-install-title"
        className="m-auto w-[min(90vw,26rem)] rounded-2xl border border-white/15 bg-slate-900 p-5 text-slate-100 backdrop:bg-black/60">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="office-install-title" className="text-base font-bold">Cài Office</h2>
          <form method="dialog">
            <button type="submit" aria-label="Đóng" className="rounded-lg p-2 hover:bg-white/10">
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
        <ul className="space-y-3 text-sm text-slate-200">
          <li><strong>iPhone hoặc iPad</strong> · Mở bằng Safari, chọn Chia sẻ → Thêm vào MH chính. Bật Mở dưới dạng ứng dụng web nếu thấy tùy chọn.</li>
          <li><strong>Android</strong> · Mở bằng Chrome, bấm ⋮ → Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</li>
        </ul>
      </dialog>
    </>
  );
}
