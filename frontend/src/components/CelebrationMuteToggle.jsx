import { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, MUTE_CHANGE_EVENT } from '@/utils/celebrate';

export const CelebrationMuteToggle = () => {
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    const onChange = (e) => setMutedState(e.detail?.muted ?? isMuted());
    window.addEventListener(MUTE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(MUTE_CHANGE_EVENT, onChange);
  }, []);

  const toggle = () => setMuted(!muted);

  return (
    <button
      onClick={toggle}
      title={muted ? 'Sounds off — tap to turn on' : 'Sounds on — tap to mute'}
      aria-label={muted ? 'Unmute celebration sounds' : 'Mute celebration sounds'}
      data-testid="celebration-mute-toggle"
      className="p-2 rounded-xl border-2 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors"
    >
      {muted
        ? <VolumeX className="w-5 h-5 text-[#3D5A80]" strokeWidth={2.5} />
        : <Volume2 className="w-5 h-5 text-[#06D6A0]" strokeWidth={2.5} />}
    </button>
  );
};
