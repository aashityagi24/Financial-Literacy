import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { 
  Wallet, Target, ShoppingCart, TrendingUp, Award, 
  Users, BookOpen, Gift, ChevronRight, ChevronLeft, X, Sparkles
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

const childSteps = [
  {
    icon: Sparkles,
    title: "Welcome to CoinQuest! 🎉",
    description: "Get ready for an amazing adventure where you'll learn about money while having fun!",
    color: "from-[#FFD23F] to-[#FFEB99]",
    image: "🏰"
  },
  {
    icon: Wallet,
    title: "Your Money Jars 🏦",
    description: "You have 4 special jars: Spending (for buying things), Savings (for your goals), Investing (to grow money), and Gifting (to share with friends)!",
    color: "from-[#06D6A0] to-[#42E8B3]",
    image: "🐷"
  },
  {
    icon: Target,
    title: "Complete Quests 🎯",
    description: "Finish quests from your teacher or parents to earn coins! The more you complete, the richer you get!",
    color: "from-[#EE6C4D] to-[#FF9F7F]",
    image: "⭐"
  },
  {
    icon: ShoppingCart,
    title: "Visit the Store 🛒",
    description: "Spend your hard-earned coins on cool items in the virtual store. But remember - save some too!",
    color: "from-[#3D5A80] to-[#5A7CA8]",
    image: "🎁"
  },
  {
    icon: TrendingUp,
    title: "Grow Your Money 📈",
    description: "Plant seeds in the Money Garden or trade in the Stock Market to watch your money grow over time!",
    color: "from-[#9B5DE5] to-[#C77DFF]",
    image: "🌱"
  },
  {
    icon: Award,
    title: "Earn Achievements 🏆",
    description: "Collect badges and trophies as you learn. Can you unlock them all?",
    color: "from-[#F72585] to-[#FF85A1]",
    image: "🎖️"
  },
  {
    icon: BookOpen,
    title: "Learn & Earn 📚",
    description: "Take fun lessons about money and earn coins for completing them. Knowledge is treasure!",
    color: "from-[#4CC9F0] to-[#72EFDD]",
    image: "💡"
  }
];

const parentSteps = [
  {
    icon: Sparkles,
    title: "Welcome to CoinQuest! 🎉",
    description: "Help your child develop healthy money habits through fun, gamified learning!",
    color: "from-[#FFD23F] to-[#FFEB99]",
    image: "👨‍👩‍👧"
  },
  {
    icon: Users,
    title: "Connect with Your Child 👨‍👩‍👧",
    description: "Link your account to your child's profile to monitor their progress and activities.",
    color: "from-[#3D5A80] to-[#5A7CA8]",
    image: "🔗"
  },
  {
    icon: Target,
    title: "Create Chores & Rewards 📝",
    description: "Assign chores with coin rewards. Approve completed chores to teach the value of earning money.",
    color: "from-[#06D6A0] to-[#42E8B3]",
    image: "✅"
  },
  {
    icon: Wallet,
    title: "Manage Allowances 💰",
    description: "Set up recurring allowances and one-time rewards. You can also apply penalties for learning moments.",
    color: "from-[#EE6C4D] to-[#FF9F7F]",
    image: "📅"
  },
  {
    icon: Gift,
    title: "Give Money & Gifts 🎁",
    description: "Transfer coins directly to your child's wallet for special occasions or as surprise rewards!",
    color: "from-[#9B5DE5] to-[#C77DFF]",
    image: "💝"
  },
  {
    icon: TrendingUp,
    title: "Track Progress 📊",
    description: "View detailed insights about your child's spending, saving, and learning activities from your dashboard.",
    color: "from-[#4CC9F0] to-[#72EFDD]",
    image: "📈"
  }
];

export default function OnboardingTour({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  
  const steps = user?.role === 'parent' ? parentSteps : childSteps;
  const isLastStep = currentStep === steps.length - 1;
  
  useEffect(() => {
    // Show onboarding only for child/parent who haven't completed it
    if (user && (user.role === 'child' || user.role === 'parent') && !user.has_completed_onboarding) {
      setIsOpen(true);
    }
  }, [user]);
  
  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };
  
  const handleComplete = async () => {
    try {
      await axios.post(`${API}/auth/complete-onboarding`);
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
    }
    setIsOpen(false);
    if (onComplete) onComplete();
  };
  
  const handleSkip = async () => {
    await handleComplete();
  };
  
  if (!isOpen) return null;
  
  const step = steps[currentStep];
  const StepIcon = step.icon;
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-white border-4 border-[#1D3557] rounded-3xl max-w-lg p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          data-testid="onboarding-skip"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${step.color} p-8 text-center`}>
          <div className="text-6xl mb-4 animate-bounce">{step.image}</div>
          <div className="bg-white/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <StepIcon className="w-8 h-8 text-white" />
          </div>
          <h2 
            className="text-2xl font-bold text-[#1D3557]" 
            style={{ fontFamily: 'Fredoka' }}
            data-testid="onboarding-title"
          >
            {step.title}
          </h2>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <p className="text-[#3D5A80] text-center text-lg mb-6">
            {step.description}
          </p>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentStep 
                    ? 'bg-[#FFD23F] scale-125' 
                    : index < currentStep 
                      ? 'bg-[#06D6A0]' 
                      : 'bg-gray-300'
                }`}
                data-testid={`onboarding-dot-${index}`}
              />
            ))}
          </div>
          
          {/* Navigation buttons */}
          <div className="flex justify-between gap-4">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#E0FBFC] text-[#3D5A80] hover:bg-[#98C1D9]'
              }`}
              data-testid="onboarding-prev"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            
            <button
              onClick={handleNext}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                isLastStep 
                  ? 'bg-[#06D6A0] hover:bg-[#05B88A]' 
                  : 'bg-[#3D5A80] hover:bg-[#1D3557]'
              }`}
              data-testid="onboarding-next"
            >
              {isLastStep ? (
                <>
                  Let&apos;s Go! <Sparkles className="w-5 h-5" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
          
          {/* Step counter */}
          <p className="text-center text-sm text-gray-400 mt-4">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
