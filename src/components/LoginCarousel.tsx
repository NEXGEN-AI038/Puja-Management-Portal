import { useEffect, useState } from 'react';

const SLIDES = [
  { src: '/festivals/durga-puja.jpg', label: 'Durga Puja', alt: 'Durga Puja pandal with the idol of Goddess Durga and her family' },
  { src: '/festivals/holi-1.jpg', pos: '38%', label: 'Holi', alt: 'Smiling woman with hands and face covered in yellow and pink Holi colours' },
  { src: '/festivals/kali-puja.jpg', label: 'Kali Puja', alt: 'Richly decorated idol of Goddess Kali' },
  { src: '/festivals/lohri-1.jpg', label: 'Lohri', alt: 'Community gathered around a large Lohri bonfire at night' },
  { src: '/festivals/diwali.jpg', label: 'Diwali', alt: 'A hand holding a lit diya above a thali of glowing lamps' },
  { src: '/festivals/holi-2.jpg', pos: '34%', label: 'Holi', alt: 'Friends playing Holi with red and yellow colours on their hands' },
  { src: '/festivals/laxmi-puja.jpg', label: 'Lakshmi Puja', alt: 'Goddess Lakshmi adorned with jewellery and roses' },
  { src: '/festivals/lohri-2.jpg', label: 'Lohri', alt: 'Folk musicians in colourful turbans playing bagpipes and drums' },
  { src: '/festivals/ganesh-chaturthi.jpg', label: 'Ganesh Chaturthi', alt: 'Large Ganesh idol surrounded by a celebrating crowd' },
  { src: '/festivals/christmas.jpg', label: 'Christmas', alt: 'Two friends smiling beside a decorated Christmas tree' },
  { src: '/festivals/new-year.jpg', label: 'New Year', alt: 'Gold and silver balloons with confetti for New Year' },
];

const INTERVAL_MS = 5500;

/** Full-bleed festival slideshow for the login brand panel. Place as the first child of a `relative overflow-hidden` container. */
export function LoginCarousel() {
  const [active, setActive] = useState(0);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  // Restarts whenever `active` changes, so clicking a dot resets the timer.
  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [active, reduceMotion]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden={false}>
        {SLIDES.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={i === active ? s.alt : ''}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: `center ${(s as { pos?: string }).pos ?? '30%'}`,
              opacity: i === active ? 1 : 0,
              transform: !reduceMotion && i === active ? 'scale(1.08)' : 'scale(1)',
              transition: reduceMotion ? 'opacity 300ms' : 'opacity 1200ms ease, transform 7000ms ease-out',
            }}
          />
        ))}
        {/* Brand tint keeps the white text readable on any photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/90 via-brand-900/60 to-brand-900/40" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-900/80 to-transparent" />
      </div>

      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        <span className="hidden text-xs font-medium tracking-wide text-gold-300 sm:block">{SLIDES[active].label}</span>
        <div className="flex gap-1.5" role="tablist" aria-label="Festival images">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              role="tab"
              aria-selected={i === active}
              aria-label={`Show ${s.label}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-gold-400' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
