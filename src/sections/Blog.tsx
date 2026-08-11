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

function ArticleMeta({ post }: { post: BlogPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] text-[13px] md:text-[14px] text-[#5b6472]">
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
    <section id="blog" aria-labelledby="journal-heading" className="w-full max-w-[1440px] px-[20px] pb-[40px] md:px-[30px] md:pb-[77px]">
      <Reveal className="mb-[32px] grid gap-[20px] md:mb-[48px] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-[760px]">
          <p className="mb-[12px] text-[13px] font-semibold uppercase tracking-[0.18em] text-[#1099A1]">Yakal Journal</p>
          <h2 id="journal-heading" className="text-[40px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[68px]">
            Guidance for every next step
          </h2>
          <p className="mt-[18px] max-w-[620px] text-[16px] leading-[26px] text-[#4a4a4a] md:text-[18px] md:leading-[30px]">
            Practical perspectives for students and families navigating academics, admissions, and everything in between.
          </p>
        </div>
        <button onClick={() => navigate("/posts")} className="group inline-flex w-fit items-center gap-[8px] text-[15px] font-semibold text-[#1099A1] hover:text-[#0d7f86] md:mb-[7px] md:text-[17px]">
          View all articles
          <ArrowRight aria-hidden="true" size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </Reveal>

      {featured ? (
        <Reveal>
          <article className="mb-[28px] grid overflow-hidden rounded-[20px] bg-[#f5f7f4] md:mb-[30px] md:grid-cols-[1.08fr_0.92fr] md:rounded-[30px]">
            <div className="min-h-[260px] overflow-hidden bg-[#e9ece8] md:min-h-[520px]">
              {featured.thumbnail_url && (
                <SkeletonImg src={featured.thumbnail_url} alt={`Featured article: ${featured.title}`} className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]" />
              )}
            </div>
            <div className="flex flex-col justify-center p-[24px] sm:p-[32px] md:p-[48px] lg:p-[64px]">
              <p className="mb-[14px] text-[13px] font-semibold uppercase tracking-[0.16em] text-[#1099A1]">{categoryFor(featured)}</p>
              <ArticleMeta post={featured} />
              <h3 className="mt-[18px] text-[30px] font-medium leading-[1.15] tracking-[-0.015em] md:text-[44px]">{featured.title}</h3>
              <p className="mt-[16px] text-[16px] leading-[26px] text-[#4a4a4a] md:text-[18px] md:leading-[30px]">
                {plainText(featured.content).slice(0, 220)}{plainText(featured.content).length > 220 ? "..." : ""}
              </p>
              <button onClick={() => navigate(`/post/${featured.id}`)} className="group mt-[28px] inline-flex w-fit items-center gap-[9px] rounded-[500px] bg-[#1099A1] px-[24px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-[#0d7f86] md:mt-[36px]">
                Read article
                <ArrowRight aria-hidden="true" size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </article>
        </Reveal>
      ) : null}

      <div className="grid grid-cols-1 gap-[24px] md:grid-cols-3 md:gap-[30px]">
        {blogs.slice(1).map((blog, index) => (
          <Reveal key={blog.id} delay={index * 100}>
            <article className="group flex h-full flex-col">
              <button onClick={() => navigate(`/post/${blog.id}`)} aria-label={`Read ${blog.title}`} className="h-[230px] overflow-hidden rounded-[20px] bg-[#f1f2f0] text-left md:h-[300px] md:rounded-[30px]">
                {blog.thumbnail_url && <SkeletonImg src={blog.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </button>
              <div className="flex flex-1 flex-col px-[4px] pt-[18px] md:px-[8px] md:pt-[22px]">
                <p className="mb-[10px] text-[12px] font-semibold uppercase tracking-[0.14em] text-[#1099A1]">{categoryFor(blog)}</p>
                <ArticleMeta post={blog} />
                <h3 className="mt-[12px] text-[22px] font-medium leading-[1.3] md:text-[25px]">
                  <button onClick={() => navigate(`/post/${blog.id}`)} className="text-left transition-colors hover:text-[#0d7f86]">{blog.title}</button>
                </h3>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-[36px] rounded-[20px] bg-[#eef6ef] p-[24px] md:mt-[54px] md:rounded-[30px] md:p-[38px]">
        <div className="grid gap-[22px] md:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] md:items-center md:gap-[40px]">
          <div>
            <p className="mb-[8px] text-[12px] font-semibold uppercase tracking-[0.16em] text-[#0d7f86]">Notes from Yakal</p>
            <h3 className="text-[25px] font-medium leading-tight md:text-[30px]">Fresh guidance, thoughtfully delivered.</h3>
            <p className="mt-[8px] text-[15px] leading-[24px] text-[#4a4a4a]">Get new articles and useful resources in your inbox.</p>
          </div>
          <NewsletterSignup source="landing-blog" tone="light" />
        </div>
      </Reveal>
    </section>
  );
}
