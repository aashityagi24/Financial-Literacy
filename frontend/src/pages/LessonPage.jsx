import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Check, Award, Star, ArrowRight,
  BookOpen, Clock
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from 'react-markdown';

export default function LessonPage({ user }) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResults, setQuizResults] = useState(null);
  
  useEffect(() => {
    fetchLessonData();
  }, [lessonId]);
  
  const fetchLessonData = async () => {
    try {
      const response = await axios.get(`${API}/learn/lessons/${lessonId}`);
      setLesson(response.data.lesson);
      setQuiz(response.data.quiz);
      if (response.data.quiz) {
        setQuizAnswers(new Array(response.data.quiz.questions.length).fill(-1));
      }
    } catch (error) {
      toast.error('Failed to load lesson');
      navigate('/learn');
    } finally {
      setLoading(false);
    }
  };
  
  const handleComplete = async () => {
    setCompleting(true);
    try {
      const response = await axios.post(`${API}/learn/lessons/${lessonId}/complete`);
      if (response.data.reward > 0) {
        toast.success(`Lesson completed! +${response.data.reward} coins`);
      } else {
        toast.info('Lesson already completed');
      }
      navigate(-1);
    } catch (error) {
      toast.error('Failed to complete lesson');
    } finally {
      setCompleting(false);
    }
  };
  
  const handleQuizSubmit = async () => {
    if (quizAnswers.some(a => a === -1)) {
      toast.error('Please answer all questions');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/learn/quiz/submit`, {
        quiz_id: quiz.quiz_id,
        answers: quizAnswers
      });
      setQuizResults(response.data);
      
      if (response.data.passed) {
        toast.success(`Quiz passed! +₹${response.data.bonus_coins} bonus!`);
      } else {
        toast.info(`Score: ${response.data.score}%. Try again!`);
      }
    } catch (error) {
      toast.error('Failed to submit quiz');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="lesson-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]"
            >
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#1D3557]" />
              </div>
              <h1 className="text-lg font-bold text-[#1D3557] truncate" style={{ fontFamily: 'Fredoka' }}>
                {lesson?.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#3D5A80]">
              <Clock className="w-4 h-4" />
              <span>{lesson?.duration_minutes} min</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {!showQuiz ? (
          <>
            {/* Lesson Content */}
            <div className="card-playful p-6 mb-6 animate-bounce-in">
              <div className="prose prose-lg max-w-none">
                <div className="lesson-content text-[#1D3557]">
                  {/* Simple Markdown-like rendering */}
                  {lesson?.content?.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) {
                      return <h1 key={i} className="text-2xl font-bold text-[#1D3557] mt-4 mb-3" style={{ fontFamily: 'Fredoka' }}>{line.slice(2)}</h1>;
                    }
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-xl font-bold text-[#1D3557] mt-4 mb-2" style={{ fontFamily: 'Fredoka' }}>{line.slice(3)}</h2>;
                    }
                    if (line.startsWith('- ')) {
                      return <li key={i} className="text-[#3D5A80] ml-4">{line.slice(2)}</li>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-bold text-[#1D3557]">{line.slice(2, -2)}</p>;
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    return <p key={i} className="text-[#3D5A80] mb-2">{line}</p>;
                  })}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-4">
              {quiz ? (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="btn-primary flex-1 py-4 text-lg flex items-center justify-center gap-2"
                >
                  Take Quiz <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="btn-primary flex-1 py-4 text-lg flex items-center justify-center gap-2"
                >
                  {completing ? 'Completing...' : (
                    <>Complete Lesson <Check className="w-5 h-5" /></>
                  )}
                </button>
              )}
            </div>
            
            <p className="text-center text-sm text-[#3D5A80] mt-4">
              <Star className="w-4 h-4 inline text-[#FFD23F]" /> Earn ₹{lesson?.reward_coins} for completing this lesson
            </p>
          </>
        ) : (
          <>
            {/* Quiz Section */}
            <div className="card-playful p-6 mb-6 animate-bounce-in">
              <h2 className="text-2xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                📝 {quiz?.title || 'Quiz Time!'}
              </h2>
              
              {!quizResults ? (
                <div className="space-y-6">
                  {quiz?.questions?.map((q, qIndex) => (
                    <div key={qIndex} className="bg-[#E0FBFC] rounded-xl p-4 border-2 border-[#1D3557]">
                      <p className="font-bold text-[#1D3557] mb-3">
                        {qIndex + 1}. {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options?.map((option, oIndex) => (
                          <button
                            key={oIndex}
                            onClick={() => {
                              const newAnswers = [...quizAnswers];
                              newAnswers[qIndex] = oIndex;
                              setQuizAnswers(newAnswers);
                            }}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                              quizAnswers[qIndex] === oIndex
                                ? 'bg-[#FFD23F] border-[#1D3557]'
                                : 'bg-white border-[#1D3557]/30 hover:border-[#1D3557]'
                            }`}
                          >
                            {String.fromCharCode(65 + oIndex)}. {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={handleQuizSubmit}
                    className="btn-primary w-full py-4 text-lg"
                  >
                    Submit Answers
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Results Summary */}
                  <div className={`rounded-xl p-6 text-center ${
                    quizResults.passed ? 'bg-[#06D6A0]/20' : 'bg-[#EE6C4D]/20'
                  }`}>
                    <div className="text-5xl mb-3">
                      {quizResults.passed ? '🎉' : '🤔'}
                    </div>
                    <p className="text-3xl font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>
                      {quizResults.score}%
                    </p>
                    <p className="text-[#3D5A80]">
                      {quizResults.correct} of {quizResults.total} correct
                    </p>
                    {quizResults.passed && quizResults.bonus_coins > 0 && (
                      <p className="mt-2 text-[#06D6A0] font-bold">
                        +₹{quizResults.bonus_coins} bonus!
                      </p>
                    )}
                  </div>
                  
                  {/* Answer Review */}
                  {quizResults.results?.map((result, index) => (
                    <div 
                      key={index}
                      className={`rounded-xl p-4 border-2 ${
                        result.is_correct ? 'bg-[#06D6A0]/10 border-[#06D6A0]' : 'bg-[#EE6C4D]/10 border-[#EE6C4D]'
                      }`}
                    >
                      <p className="font-bold text-[#1D3557] mb-2">
                        {index + 1}. {result.question}
                      </p>
                      <p className={`text-sm ${result.is_correct ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                        {result.is_correct ? '✓ Correct!' : `✗ Incorrect. The answer was: ${String.fromCharCode(65 + result.correct_answer)}`}
                      </p>
                      {result.explanation && (
                        <p className="text-sm text-[#3D5A80] mt-2 italic">{result.explanation}</p>
                      )}
                    </div>
                  ))}
                  
                  <div className="flex gap-4">
                    {!quizResults.passed && (
                      <button
                        onClick={() => {
                          setQuizResults(null);
                          setQuizAnswers(new Array(quiz.questions.length).fill(-1));
                        }}
                        className="btn-secondary flex-1 py-3"
                      >
                        Try Again
                      </button>
                    )}
                    <button
                      onClick={() => navigate(-1)}
                      className="btn-primary flex-1 py-3"
                    >
                      Back to Topic
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowQuiz(false)}
              className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back to lesson content
            </button>
          </>
        )}
      </main>
    </div>
  );
}
