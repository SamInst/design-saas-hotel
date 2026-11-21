import styles from './AnimatedSpinner.module.css';

export function AnimatedSpinner({ size = '10rem', lineWidth = '1rem', className = '', style }) {
  return (
    <span
      className={`${styles.spinner} ${className}`}
      style={{ '--size': size, '--lw-max': lineWidth, ...style }}
      aria-hidden="true"
    />
  );
}

export default AnimatedSpinner;
