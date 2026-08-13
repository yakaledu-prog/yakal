import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import NewsletterSignup from "@/components/NewsletterSignup";
import Reveal from "@/components/Reveal";
import SkeletonImg from "@/components/SkeletonImg";
import { getPosts, type BlogPost } from "@/services/cmsService";

function plainText(html: string) {
  return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}

function categoryFor(post: BlogPost) {
  return post.category ?? "Yakal Journal";
}

const categoryStyles: Record<string, { text: string; rule: string }> = {
  "Study Skills": { text: "text-[#0d7f86]", rule: "bg-[#97CE9D]" },
  Admissions: { text: "text-[#1099A1]", rule: "bg-[#CAA25F]" },
  "Parent Guide": { text: "text-[#1099A1]", rule: "bg-[#1099A1]" },
  "Yakal News": { text: "text-[#0d7f86]", rule: "bg-[#0d7f86]" },
  "Yakal Journal": { text: "text-[#1099A1]", rule: "bg-[#1099A1]" },
};

function CategoryLabel({ post }: { post: BlogPost }) {
  const category = categoryFor(post);
  const style = categoryStyles[category] ?? categoryStyles["Yakal Journal"];
  return (
    <div className="flex items-center gap-[9px]">
      <span aria-hidden="true" className={`h-[3px] w-[24px] rounded-full ${style.rule}`} />
      <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] sm:text-[12px] ${style.text}`}>
        {category}
      </p>
    </div>
  );
}

function ArticleMeta({ post }: { post: BlogPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[9px] gap-y-[4px] text-[12px] text-[#5b6472] md:text-[14px]">
      <span>{post.read_time_minutes} min read</span>
      <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[#CAA25F]" />
      <time dateTime={post.created_at}>{format(new Date(post.created_at), "MMM d, yyyy")}</time>
    </div>
  );
}

export default function Blog() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState<BlogPost[]>([]);

  useEffect(() => {
    getPosts().then((posts) => setBlogs(posts.filter((post) => post.status === "published").slice(0, 4)));
  }, []);

  const featured = blogs[0];

  return (
    <section id="blog" aria-labelledby="journal-heading" className="w-full max-w-[1440px] overflow-hidden px-[16px] pb-[44px] sm:px-[20px] md:px-[30px] md:pb-[77px]">
      <Reveal className="mb-[26px] grid gap-[16px] md:mb-[48px] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-[760px]">
          <p className="mb-[9px] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1099A1] sm:text-[13px]">Yakal Journal</p>
          <h2 id="journal-heading" className="max-w-[11ch] text-[34px] font-medium leading-[1.06] tracking-[-0.025em] sm:text-[40px] md:max-w-none md:text-[68px]">
            Guidance for every next step
          </h2>
          <p className="mt-[13px] max-w-[620px] text-[15px] leading-[23px] text-[#4a4a4a] sm:text-[16px] sm:leading-[26px] md:mt-[18px] md:text-[18px] md:leading-[30px]">
            Practical perspectives for students and families navigating academics, admissions, and everything in between.
          </p>
        </div>
        <button onClick={() => navigate("/posts")} className="group inline-flex min-h-[44px] w-fit items-center gap-[8px] text-[14px] font-semibold text-[#1099A1] hover:text-[#0d7f86] md:mb-[7px] md:text-[17px]">
          View all articles
          <ArrowRight aria-hidden="true" size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </Reveal>

      {featured ? (
        <Reveal>
          <article className="mb-[30px] grid overflow-hidden rounded-[22px] border border-[#1099A1]/10 bg-[#f5f7f4] shadow-[0_18px_42px_-34px_rgba(16,153,161,0.75)] md:grid-cols-[1.08fr_0.92fr] md:rounded-[30px] md:border-0 md:shadow-none">
            <button
              onClick={() => navigate(`/post/${featured.id}`)}
              aria-label={`Read ${featured.title}`}
              className="aspect-[16/10] overflow-hidden bg-[#e9ece8] text-left md:aspect-auto md:min-h-[520px]"
            >
              {featured.thumbnail_url && (
                <SkeletonImg src={featured.thumbnail_url} alt={`Featured article: ${featured.title}`} className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]" />
              )}
            </button>
            <div className="flex flex-col justify-center p-[20px] pb-[22px] sm:p-[28px] md:p-[48px] lg:p-[64px]">
              <CategoryLabel post={featured} />
              <div className="mt-[10px]"><ArticleMeta post={featured} /></div>
              <h3 className="mt-[13px] text-[27px] font-medium leading-[1.12] tracking-[-0.02em] sm:text-[30px] md:mt-[18px] md:text-[44px]">{featured.title}</h3>
              <p className="mt-[12px] line-clamp-3 text-[15px] leading-[23px] text-[#4a4a4a] sm:text-[16px] sm:leading-[26px] md:mt-[16px] md:line-clamp-none md:text-[18px] md:leading-[30px]">
                {plainText(featured.content).slice(0, 220)}{plainText(featured.content).length > 220 ? "..." : ""}
              </p>
              <button onClick={() => navigate(`/post/${featured.id}`)} className="group mt-[20px] inline-flex min-h-[44px] w-fit items-center gap-[9px] rounded-[500px] bg-[#1099A1] px-[22px] py-[11px] text-[14px] font-semibold text-white transition-colors hover:bg-[#0d7f86] md:mt-[36px] md:px-[24px] md:py-[13px] md:text-[15px]">
                Read article
                <ArrowRight aria-hidden="true" size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </article>
        </Reveal>
      ) : null}

      {blogs.length > 1 && (
        <p className="mb-[14px] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6472] md:hidden">More from the journal</p>
      )}
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3 md:gap-[30px]">
        {blogs.slice(1).map((blog, index) => (
          <Reveal key={blog.id} delay={index * 100}>
            <article className="group grid h-full grid-cols-[104px_minmax(0,1fr)] gap-[14px] border-b border-[#1099A1]/10 pb-[14px] last:border-b-0 md:flex md:flex-col md:border-b-0 md:pb-0">
              <button onClick={() => navigate(`/post/${blog.id}`)} aria-label={`Read ${blog.title}`} className="aspect-square h-[104px] overflow-hidden rounded-[16px] bg-[#f1f2f0] text-left md:h-[300px] md:w-full md:rounded-[30px]">
                {blog.thumbnail_url && <SkeletonImg src={blog.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </button>
              <div className="flex min-w-0 flex-1 flex-col justify-center md:px-[8px] md:pt-[22px]">
                <CategoryLabel post={blog} />
                <h3 className="mt-[8px] line-clamp-2 text-[18px] font-medium leading-[1.2] tracking-[-0.01em] md:order-2 md:mt-[12px] md:text-[25px] md:leading-[1.3]">
                  <button onClick={() => navigate(`/post/${blog.id}`)} className="min-h-[44px] text-left transition-colors hover:text-[#0d7f86]">{blog.title}</button>
                </h3>
                <div className="mt-[7px] md:order-1 md:mb-[10px] md:mt-[10px]"><ArticleMeta post={blog} /></div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-[30px] rounded-[22px] border-t-[4px] border-[#97CE9D] bg-[#eef6ef] p-[20px] sm:p-[24px] md:mt-[54px] md:rounded-[30px] md:p-[38px]">
        <div className="grid gap-[18px] md:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] md:items-center md:gap-[40px]">
          <div>
            <p className="mb-[8px] text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0d7f86]">Notes from Yakal</p>
            <h3 className="text-[23px] font-medium leading-tight md:text-[30px]">Fresh guidance, thoughtfully delivered.</h3>
            <p className="mt-[8px] text-[15px] leading-[24px] text-[#4a4a4a]">Get new articles and useful resources in your inbox.</p>
          </div>
          <NewsletterSignup source="landing-blog" tone="light" />
        </div>
      </Reveal>
    </section>
  );
}
