import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { UserLoyaltyStatus } from '../../services/loyaltyService';
import PointsAndTierCard from './PointsAndTierCard';
import TransactionList from './TransactionList';
import { PointsTransaction } from '../../services/loyaltyService';

interface LoyaltyCarouselProps {
  loyaltyStatus: UserLoyaltyStatus;
  transactions: PointsTransaction[];
}

export default function LoyaltyCarousel({ loyaltyStatus, transactions }: LoyaltyCarouselProps) {
  const { i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const pointsCardRef = useRef<HTMLDivElement>(null);

  // Measure the PointsAndTierCard height. The language is a dependency
  // because the card renders localized perk copy: switching the UI language
  // changes the content length (and therefore the height) without any
  // loyaltyStatus change, which would otherwise leave a stale fixed height.
  useEffect(() => {
    if (pointsCardRef.current) {
      const height = pointsCardRef.current.offsetHeight;
      setCardHeight(height);
    }
  }, [loyaltyStatus, i18n.language]);

  const slides = [
    {
      id: 'points-tier',
      component: (
        <div ref={pointsCardRef}>
          <PointsAndTierCard loyaltyStatus={loyaltyStatus} />
        </div>
      )
    },
    {
      id: 'transactions',
      component: <TransactionList transactions={transactions} isLoading={false} />
    }
  ];

  const totalSlides = slides.length;

  // Minimum swipe distance (in px) to trigger slide change
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0); // Reset to detect new swipe
    setTouchStart(e.targetTouches[0]?.clientX ?? 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? 0);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }

    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  };

  return (
    <div className="relative">
      {/* Carousel Container */}
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={cardHeight ? { height: `${cardHeight}px` } : undefined}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)`, height: '100%' }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="w-full flex-shrink-0 h-full"
              style={{ minWidth: '100%' }}
            >
              {slide.component}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons - Hidden on mobile, shown on desktop */}
      <button
        onClick={goToPrevious}
        disabled={currentSlide === 0}
        className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10
          items-center justify-center w-10 h-10 rounded-full bg-white
          ${currentSlide === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-50'}`}
        aria-label="Previous slide"
      >
        <FiChevronLeft className="w-6 h-6 text-stone-600" />
      </button>

      <button
        onClick={goToNext}
        disabled={currentSlide === totalSlides - 1}
        className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10
          items-center justify-center w-10 h-10 rounded-full bg-white
          ${currentSlide === totalSlides - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-50'}`}
        aria-label="Next slide"
      >
        <FiChevronRight className="w-6 h-6 text-stone-600" />
      </button>

      {/* Pagination Dots — each button is a full 44px hit area around a small visual dot */}
      <div className="flex items-center justify-center mt-6">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            aria-label={`Go to slide ${index + 1}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 rounded-full transition-all duration-300
                ${currentSlide === index ? 'w-8 bg-brand-600' : 'w-2 bg-stone-300'}`}
            />
          </button>
        ))}
      </div>

      {/* Slide Counter - Mobile only */}
      <div className="md:hidden text-center mt-2 text-sm text-stone-600">
        {currentSlide + 1} / {totalSlides}
      </div>
    </div>
  );
}
