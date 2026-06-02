import { Link } from 'react-router-dom'
import SoroBlogEmbed from '../components/SoroBlogEmbed'
import SeoHead from '../components/seo/SeoHead'
import SeoBreadcrumbJsonLd from '../components/seo/SeoBreadcrumbJsonLd'

export default function BlogPage() {
  return (
    <div className="min-w-0 bg-white py-10 sm:py-14">
      <SeoHead
        title="Removals Blog | ShiftMyHome"
        description="Tips, guides and updates on house removals, man with van moves and furniture delivery across Scotland from the ShiftMyHome team."
        path="/blog"
        includeSocial
      />
      <SeoBreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]} />
      <div className="mx-auto min-w-0 max-w-4xl px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <Link to="/" className="font-medium text-brand-700 hover:text-brand-800">
            Home
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-700">Blog</span>
        </nav>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Blog</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Practical advice on removals, packing and moving across Scotland.
        </p>
        <div className="mt-8 min-h-[24rem]">
          <SoroBlogEmbed className="min-w-0" />
        </div>
      </div>
    </div>
  )
}
