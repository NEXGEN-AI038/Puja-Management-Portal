import { useEffect, useState } from 'react';

interface Slide { src: string; label: string; alt: string; pos?: string }

const SLIDES: Slide[] = [
  { src: '/festivals/durga-puja.jpg', label: 'Durga Puja', alt: 'Durga Puja pandal with the idol of Goddess Durga and her family' },
  { src: '/festivals/republic-day.jpg', pos: '55%', label: 'Republic Day', alt: 'Motorcycle riders forming a human pyramid on a misty parade road' },
  { src: '/festivals/holi-1.jpg', pos: '38%', label: 'Holi', alt: 'Smiling woman with hands and face covered in yellow and pink Holi colours' },
  { src: '/festivals/saraswati-puja.jpg', pos: '18%', label: 'Saraswati Puja', alt: 'Goddess Saraswati holding a veena, adorned with flowers' },
  { src: '/festivals/kali-puja.jpg', label: 'Kali Puja', alt: 'Richly decorated idol of Goddess Kali' },
  { src: '/festivals/rath-yatra.jpg', pos: '50%', label: 'Rath Yatra', alt: 'Deities of Jagannath, Balabhadra and Subhadra decorated with flowers' },
  { src: '/festivals/lohri-1.jpg', label: 'Lohri', alt: 'Community gathered around a large Lohri bonfire at night' },
  { src: '/festivals/shivratri.jpg', pos: '28%', label: 'Maha Shivratri', alt: 'Lord Shiva idol decorated with marigold garlands' },
  { src: '/festivals/diwali.jpg', label: 'Diwali', alt: 'A hand holding a lit diya above a thali of glowing lamps' },
  { src: '/festivals/independence-day.jpg', pos: '45%', label: 'Independence Day', alt: 'Indian tricolour flying against a cloudy sky with birds' },
  { src: '/festivals/holi-2.jpg', pos: '34%', label: 'Holi', alt: 'Friends playing Holi with red and yellow colours on their hands' },
  { src: '/festivals/janmashtami.jpg', pos: '20%', label: 'Janmashtami', alt: 'Mother and child dressed as Krishna on a flower-decorated swing' },
  { src: '/festivals/laxmi-puja.jpg', label: 'Lakshmi Puja', alt: 'Goddess Lakshmi adorned with jewellery and roses' },
  { src: '/festivals/rudrabhishek.jpg', pos: '55%', label: 'Rudrabhishek', alt: 'Priest performing Rudrabhishek on a Shivling surrounded by offerings' },
  { src: '/festivals/lohri-2.jpg', label: 'Lohri', alt: 'Folk musicians in colourful turbans playing bagpipes and drums' },
  { src: '/festivals/chhath-puja.jpg', pos: '38%', label: 'Chhath Puja', alt: 'Devotees preparing offerings by the water for Chhath Puja' },
  { src: '/festivals/ganesh-chaturthi.jpg', label: 'Ganesh Chaturthi', alt: 'Large Ganesh idol surrounded by a celebrating crowd' },
  { src: '/festivals/nabo-barsho.jpg', pos: '30%', label: 'Nabo Barsho', alt: 'Girl in a red saree holding a Nabo Barsho placard' },
  { src: '/festivals/christmas.jpg', label: 'Christmas', alt: 'Two friends smiling beside a decorated Christmas tree' },
  { src: '/festivals/rabindra-jayanti.jpg', pos: '50%', label: 'Rabindra Jayanti', alt: 'Women in white and red saris walking in a street procession with placards' },
  { src: '/festivals/new-year.jpg', label: 'New Year', alt: 'Gold and silver balloons with confetti for New Year' },
];

const INTERVAL_MS = 5500;

/** Full-bleed festival slideshow for the login brand panel. Place as the first child of a `relative overflow-hidden` container. */
export function LoginCarousel() {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]));
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  // Load a photo only when it is current or up next, so 20+ slides don't download at once.
  useEffect(() => {
    setSeen((prev) => new Set(prev).add(active).add((active + 1) % SLIDES.length));
  }, [active]);

  // Restarts whenever `active` changes, so clicking a dot resets the timer.
  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [active, reduceMotion]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden={false}>
        {SLIDES.map((s, i) => seen.has(i) && (
          <img
            key={s.src}
            src={s.src}
            alt={i === active ? s.alt : ''}
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: `center ${s.pos ?? '30%'}`,
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

      <div className="absolute inset-x-4 bottom-16 z-20 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:items-end">
        <span className="hidden text-xs font-medium tracking-wide text-gold-300 sm:block">{SLIDES[active].label}</span>
        <div className="flex max-w-full flex-wrap justify-center gap-1.5" role="tablist" aria-label="Festival images">
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
