import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { BookOpen, Sparkles, ChevronRight, Users, Trophy, Star } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api/')) return `${process.env.REACT_APP_BACKEND_URL}${path}`;
  return `${process.env.REACT_APP_BACKEND_URL}/api/uploads/${path}`;
};

const typeLabels = { activity: 'Interactive Activity', book: 'Story Book', video: 'Video Lesson', worksheet: 'Worksheet', workbook: 'Workbook' };

export default function ExplorePage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/public/topics`).then(res => {
      setTopics(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalContent = topics.reduce((sum, t) => sum + (t.total_content || 0), 0);
  const totalSubtopics = topics.reduce((sum, t) => sum + (t.subtopics?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4E8] to-[#FFF8E7]">
      <Helmet>
        <title>Explore CoinQuest - Financial Literacy Activities for Kids K-5</title>
        <meta name="description" content={`Discover ${totalContent}+ interactive activities, storybooks, and worksheets teaching children about money, earning, saving, spending, and budgeting. CoinQuest makes financial literacy fun for kids K-5.`} />
        <meta property="og:title" content="Explore CoinQuest - Financial Literacy for Kids" />
        <meta property="og:description" content={`${totalContent}+ interactive activities across ${topics.length} topics. Teach children money skills through games, stories, and hands-on learning.`} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`${window.location.origin}/explore`} />
      </Helmet>

      {/* Header */}
      <header className="bg-[#1D3557] text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#FFD23F] rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>C</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>CoinQuest</h1>
          </Link>
          <Link to="/signup" className="bg-[#EE6C4D] hover:bg-[#EE6C4D]/90 text-white px-5 py-2.5 rounded-xl font-bold transition-colors" data-testid="explore-signup-btn">
            Start Learning
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
          Explore Our Learning Library
        </h1>
        <p className="text-lg text-[#3D5A80] max-w-2xl mx-auto mb-8">
          Interactive activities, storybooks, and worksheets that teach children real-world money skills through play and exploration.
        </p>
        <div className="flex justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
            <BookOpen className="w-5 h-5 text-[#EE6C4D]" />
            <span className="font-bold text-[#1D3557]">{topics.length} Topics</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
            <Star className="w-5 h-5 text-[#FFD23F]" />
            <span className="font-bold text-[#1D3557]">{totalSubtopics} Subtopics</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm">
            <Sparkles className="w-5 h-5 text-[#06D6A0]" />
            <span className="font-bold text-[#1D3557]">{totalContent}+ Activities</span>
          </div>
        </div>
      </section>

      {/* Topics Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="text-center py-12 text-[#3D5A80]">Loading curriculum...</div>
        ) : (
          <div className="space-y-10">
            {topics.map((topic, i) => (
              <article key={topic.topic_id} className="bg-white rounded-2xl shadow-sm border-2 border-[#1D3557]/10 overflow-hidden">
                <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-[#1D3557] to-[#3D5A80]">
                  {topic.image_url ? (
                    <img src={getAssetUrl(topic.image_url)} alt={topic.title} className="w-16 h-16 rounded-xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#FFD23F]/20 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-[#FFD23F]" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>
                      {topic.title}
                    </h2>
                    {topic.description && <p className="text-white/80 text-sm mt-1">{topic.description}</p>}
                    <div className="flex gap-3 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full text-white">{topic.subtopics?.length || 0} Subtopics</span>
                      <span className="text-xs px-2 py-0.5 bg-[#06D6A0]/30 rounded-full text-white">{topic.total_content} Activities</span>
                    </div>
                  </div>
                </div>

                {/* Subtopics */}
                {topic.subtopics?.length > 0 && (
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {topic.subtopics.map(st => (
                        <div key={st.topic_id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F4E8] border border-[#FFD23F]/30">
                          <ChevronRight className="w-4 h-4 text-[#EE6C4D] shrink-0" />
                          <div>
                            <h3 className="font-bold text-[#1D3557] text-sm">{st.title}</h3>
                            {st.description && <p className="text-xs text-[#3D5A80] mt-0.5">{st.description}</p>}
                            <span className="text-xs text-[#06D6A0] font-medium">{st.content_count} activities</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Content */}
                {topic.sample_content?.length > 0 && (
                  <div className="px-5 pb-5">
                    <h3 className="text-sm font-bold text-[#3D5A80] mb-2">Sample Activities:</h3>
                    <div className="flex flex-wrap gap-2">
                      {topic.sample_content.map((c, j) => (
                        <span key={j} className="text-xs px-3 py-1.5 bg-[#FFD23F]/15 text-[#1D3557] rounded-full font-medium">
                          {typeLabels[c.content_type] || c.content_type}: {c.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12 p-8 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] rounded-2xl">
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Fredoka' }}>
            Ready to start your child's money journey?
          </h2>
          <p className="text-white/90 mb-5">Join thousands of families building financial literacy through play.</p>
          <Link to="/signup" className="inline-block bg-white text-[#EE6C4D] px-8 py-3 rounded-xl font-bold hover:bg-white/90 transition-colors shadow-lg">
            Get Started Now
          </Link>
        </div>
      </main>

      {/* JSON-LD Structured Data */}
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "CoinQuest Financial Literacy Curriculum",
          "description": "Interactive financial literacy activities for children K-5",
          "numberOfItems": totalContent,
          "itemListElement": topics.map((t, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "Course",
              "name": t.title,
              "description": t.description || `Learn about ${t.title.toLowerCase()} through interactive activities`,
              "provider": { "@type": "Organization", "name": "CoinQuest by Learners Planet" },
              "educationalLevel": "K-5",
              "numberOfCredits": t.total_content
            }
          }))
        })}</script>
      </Helmet>
    </div>
  );
}
