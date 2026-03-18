import { useEffect } from 'react';
import styles from './Notification.module.css';

function playBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const amp = ctx.createGain();
    amp.gain.value = 16.0;
    osc.connect(gain);
    gain.connect(amp);
    amp.connect(ctx.destination);

    if (type === 'error') {
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(680, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    }

    osc.onended = () => ctx.close();
  } catch {}
}

export function Notification({ notification }) {
  useEffect(() => {
    if (notification) playBeep(notification.type);
  }, [notification]);

  if (!notification) return null;

  const type = notification.type || 'default';
  return (
    <div className={styles.wrap}>
      <div className={[styles.toast, styles[type] || styles.default].join(' ')}>
        <span className={styles.dot} />
        <span className={styles.text}>{notification.message}</span>
      </div>
    </div>
  );
}
