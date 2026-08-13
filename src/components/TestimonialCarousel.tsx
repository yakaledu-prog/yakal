import Carousel from "./Carousel";

export type Testimonial = { name: string; role: string; text: string; img: string };

export default function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  return (
    <Carousel
      activeColor="#fff"
      inactiveColor="rgba(255,255,255,0.35)"
      slides={items.map((t, i) => (
        <div key={i} className="bg-white rounded-[20px] p-[24px] flex flex-col gap-[24px]">
          <p className="text-[#4a4a4a] text-[16px] leading-[26px] text-justify">{t.text}</p>
          <div className="flex gap-[14px] items-center">
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-[#f3f3f3] shrink-0">
              <img src={t.img} alt={t.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-[16px] font-medium">{t.name}</p>
              <p className="text-primary text-[13px]">{t.role}</p>
            </div>
          </div>
        </div>
      ))}
    />
  );
}
