import ArticleCard from './ArticleCard.jsx'

// Responsive card grid. Uses article.id for React keys (stable per CONTRACT.md).
export default function ArticleGrid({ articles }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}
