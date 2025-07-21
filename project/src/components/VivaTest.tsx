import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Check, X, Trophy, Star, Sparkles, Award, Target, Zap, Gift, ArrowLeft, BarChart3, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VivaQuestion, VivaAttempt, Experiment } from '../types';

interface VivaTestProps {
  experimentId: string;
  onComplete: () => void;
  onCancel: () => void;
  viewMode?: boolean;
  existingAttempt?: VivaAttempt;
}

const VivaTest: React.FC<VivaTestProps> = ({ experimentId, onComplete, onCancel, viewMode = false, existingAttempt }) => {
  const { userProfile } = useAuth();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [allQuestions, setAllQuestions] = useState<VivaQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<VivaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [securityViolations, setSecurityViolations] = useState({
    tabSwitches: 0,
    windowSwitches: 0,
    aiToolDetections: 0,
    devToolsAttempts: 0
  });
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(viewMode);
  const [showCelebration, setShowCelebration] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [testCompleted, setTestCompleted] = useState(viewMode);
  const [celebrationTimer, setCelebrationTimer] = useState(30);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [aiToolsDetected, setAiToolsDetected] = useState<string[]>([]);

  // Track if test was auto-submitted due to violations
  const [autoSubmittedDueToViolation, setAutoSubmittedDueToViolation] = useState(false);

  // AI Tools and suspicious processes to detect
  const suspiciousProcesses = [
    'chatgpt', 'claude', 'bard', 'copilot', 'gemini', 'perplexity',
    'openai', 'anthropic', 'google.com/search', 'bing.com/search',
    'stackoverflow', 'github.com', 'codepen', 'jsfiddle',
    'replit', 'codesandbox', 'notion', 'obsidian', 'roam',
    'whatsapp', 'telegram', 'discord', 'slack', 'teams',
    'zoom', 'meet', 'skype', 'anydesk', 'teamviewer'
  ];

  useEffect(() => {
    fetchExperimentAndQuestions();
  }, [experimentId]);

  useEffect(() => {
    if (viewMode && existingAttempt && selectedQuestions.length > 0) {
      setAnswers(existingAttempt.answers);
      setFinalScore(existingAttempt.score);
      setTotalQuestions(existingAttempt.totalQuestions);
      setShowCelebration(true);
    }
  }, [viewMode, existingAttempt, selectedQuestions]);

  useEffect(() => {
    if (hasStarted && timeLeft > 0 && !testCompleted && !viewMode) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleAutoSubmit('Time expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [hasStarted, timeLeft, testCompleted, viewMode]);

  useEffect(() => {
    if (showCelebration && !viewMode) {
      const timer = setInterval(() => {
        setCelebrationTimer(prev => {
          if (prev <= 1) {
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [showCelebration, viewMode, onComplete]);

  // Enhanced security monitoring
  useEffect(() => {
    if (!hasStarted || testCompleted || viewMode) return;

    // Tab/Window visibility change detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched or window minimized
        handleSecurityViolation('tab', 'Tab switching detected! Stay on the test page.');
      } else {
        // Tab/window became visible again
        setIsWindowFocused(true);
      }
    };

    // Window focus/blur detection for window switching
    const handleWindowBlur = () => {
      setIsWindowFocused(false);
      handleSecurityViolation('window', 'Window switching detected! Focus must remain on test window.');
    };

    const handleWindowFocus = () => {
      if (!isWindowFocused) {
        setIsWindowFocused(true);
      }
    };

    // Keyboard shortcuts detection
    const handleKeyDown = (e: KeyboardEvent) => {
      // Developer tools detection
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'I' || e.key === 'J')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
      ) {
        e.preventDefault();
        handleSecurityViolation('devtools', 'Developer tools access attempt detected!');
        return false;
      }

      // Alt+Tab detection (window switching)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        handleSecurityViolation('window', 'Alt+Tab window switching detected!');
        return false;
      }

      // Cmd+Tab detection (Mac window switching)
      if (e.metaKey && e.key === 'Tab') {
        e.preventDefault();
        handleSecurityViolation('window', 'Cmd+Tab window switching detected!');
        return false;
      }

      // Copy/Paste detection
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        e.preventDefault();
        handleSecurityViolation('devtools', 'Copy/Paste operation blocked during test!');
        return false;
      }

      // Print screen detection
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        handleSecurityViolation('devtools', 'Screenshot attempt detected!');
        return false;
      }
    };

    // Right-click context menu detection
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleSecurityViolation('devtools', 'Right-click context menu blocked during test!');
      return false;
    };

    // Mouse leave detection (potential window switching)
    const handleMouseLeave = () => {
      handleSecurityViolation('window', 'Mouse left test window area!');
    };

    // AI Tool detection through URL monitoring
    const detectAITools = () => {
      try {
        // Check if any suspicious URLs are in browser history (limited by security)
        const currentURL = window.location.href;
        const referrer = document.referrer;
        
        suspiciousProcesses.forEach(tool => {
          if (referrer.toLowerCase().includes(tool) || currentURL.toLowerCase().includes(tool)) {
            if (!aiToolsDetected.includes(tool)) {
              setAiToolsDetected(prev => [...prev, tool]);
              handleSecurityViolation('ai', `Suspicious tool detected: ${tool}`);
            }
          }
        });

        // Check for common AI tool indicators in the page
        const pageTitle = document.title.toLowerCase();
        const pageContent = document.body.innerText.toLowerCase();
        
        const aiIndicators = ['chatgpt', 'claude', 'bard', 'copilot', 'ai assistant'];
        aiIndicators.forEach(indicator => {
          if (pageTitle.includes(indicator) || pageContent.includes(indicator)) {
            if (!aiToolsDetected.includes(indicator)) {
              setAiToolsDetected(prev => [...prev, indicator]);
              handleSecurityViolation('ai', `AI tool indicator detected: ${indicator}`);
            }
          }
        });
      } catch (error) {
        console.log('AI detection check completed');
      }
    };

    // Performance monitoring for suspicious activity
    const monitorPerformance = () => {
      try {
        // Check for unusual memory usage patterns
        if ('memory' in performance) {
          const memInfo = (performance as any).memory;
          if (memInfo.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB threshold
            handleSecurityViolation('ai', 'High memory usage detected - possible AI tool running');
          }
        }

        // Check for multiple tabs/windows
        if ('connection' in navigator) {
          const connection = (navigator as any).connection;
          if (connection && connection.downlink < 1) {
            // Low bandwidth might indicate multiple applications running
            handleSecurityViolation('ai', 'Low bandwidth detected - possible multiple applications');
          }
        }
      } catch (error) {
        console.log('Performance monitoring check completed');
      }
    };

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Set up periodic monitoring
    const aiDetectionInterval = setInterval(detectAITools, 5000); // Check every 5 seconds
    const performanceInterval = setInterval(monitorPerformance, 10000); // Check every 10 seconds

    // Initial checks
    detectAITools();
    monitorPerformance();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearInterval(aiDetectionInterval);
      clearInterval(performanceInterval);
    };
  }, [hasStarted, testCompleted, viewMode, isWindowFocused, aiToolsDetected]);

  const handleSecurityViolation = (type: 'tab' | 'window' | 'ai' | 'devtools', message: string) => {
    setSecurityViolations(prev => {
      const newViolations = { ...prev };
      
      switch (type) {
        case 'tab':
          newViolations.tabSwitches += 1;
          break;
        case 'window':
          newViolations.windowSwitches += 1;
          break;
        case 'ai':
          newViolations.aiToolDetections += 1;
          break;
        case 'devtools':
          newViolations.devToolsAttempts += 1;
          break;
      }

      const totalViolations = newViolations.tabSwitches + newViolations.windowSwitches + 
                             newViolations.aiToolDetections + newViolations.devToolsAttempts;

      if (totalViolations === 1) {
        setWarningMessage(`🚨 FINAL WARNING: ${message} - One more violation will auto-submit your test with 0 marks!`);
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
      } else if (totalViolations >= 2) {
        setAutoSubmittedDueToViolation(true);
        handleAutoSubmit(`Multiple security violations detected: ${message}`);
      }

      return newViolations;
    });
  };

  // Function to randomly select exactly 10 questions for each student
  const selectQuestionsForStudent = (questions: VivaQuestion[], studentId: string) => {
    if (questions.length === 0) {
      return [];
    }

    if (questions.length <= 10) {
      // If 10 or fewer questions, use all of them
      return questions;
    }
    
    // Use student ID as seed for consistent randomization per student
    const seed = studentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Create a seeded random function
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    // Create array of indices
    const indices = Array.from({ length: questions.length }, (_, i) => i);
    
    // Shuffle indices using seeded random
    for (let i = indices.length - 1; i > 0; i--) {
      const randomSeed = seed + i;
      const j = Math.floor(seededRandom(randomSeed) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Select first 10 indices and sort them to maintain question order
    const selectedIndices = indices.slice(0, 10).sort((a, b) => a - b);
    
    // Return selected questions
    return selectedIndices.map(index => questions[index]);
  };

  const fetchExperimentAndQuestions = async () => {
    try {
      console.log('Fetching experiment and questions for:', experimentId);
      
      // Fetch experiment details
      const experimentsSnapshot = await getDocs(query(
        collection(db, 'experiments'),
        where('__name__', '==', experimentId)
      ));
      
      if (!experimentsSnapshot.empty) {
        const experimentData = {
          id: experimentsSnapshot.docs[0].id,
          ...experimentsSnapshot.docs[0].data(),
          createdAt: experimentsSnapshot.docs[0].data().createdAt?.toDate() || new Date()
        } as Experiment;
        console.log('Found experiment:', experimentData);
        setExperiment(experimentData);
      }

      // Fetch viva questions
      const questionsQuery = query(
        collection(db, 'vivaQuestions'),
        where('experimentId', '==', experimentId)
      );
      const questionsSnapshot = await getDocs(questionsQuery);
      const questionsData = questionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VivaQuestion[];

      console.log('Found questions:', questionsData.length);
      setAllQuestions(questionsData);
      
      if (questionsData.length > 0 && userProfile) {
        // Select exactly 10 random questions for this student
        const studentQuestions = selectQuestionsForStudent(questionsData, userProfile.uid);
        console.log('Selected questions for student:', studentQuestions.length);
        setSelectedQuestions(studentQuestions);
        
        if (!viewMode) {
          setAnswers(new Array(studentQuestions.length).fill(-1));
          setTimeLeft(studentQuestions.length * 60); // 60 seconds per question
        }
        setTotalQuestions(studentQuestions.length);
      } else {
        console.log('No questions found for experiment:', experimentId);
        setSelectedQuestions([]);
        setTotalQuestions(0);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setSelectedQuestions([]);
      setTotalQuestions(0);
    }
  };

  const handleStartTest = () => {
    setHasStarted(true);
    // Request fullscreen mode for better security
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (viewMode) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < selectedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitTest = async () => {
    if (isSubmitting || testCompleted || viewMode) return;
    
    setIsSubmitting(true);
    setTestCompleted(true);
    
    try {
      // Calculate score
      let score = 0;
      
      // If auto-submitted due to violation, assign 0 marks
      if (autoSubmittedDueToViolation) {
        score = 0;
        console.log('Test auto-submitted due to security violations - Score set to 0');
      } else {
        // Normal scoring for legitimate submissions
        answers.forEach((answer, index) => {
          if (answer === selectedQuestions[index].correctAnswer) {
            score++;
          }
        });
      }

      setFinalScore(score);

      // Save attempt to Firestore with security violation data
      await addDoc(collection(db, 'vivaAttempts'), {
        studentId: userProfile!.uid,
        experimentId: experimentId,
        score: score,
        totalQuestions: selectedQuestions.length,
        completedAt: new Date(),
        answers: answers,
        selectedQuestionIds: selectedQuestions.map(q => q.id), // Store which questions were selected
        securityViolations: securityViolations,
        aiToolsDetected: aiToolsDetected,
        autoSubmittedDueToViolation: autoSubmittedDueToViolation,
        violationReason: autoSubmittedDueToViolation ? 'Security violations detected during test' : null
      });

      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.log('Exit fullscreen failed:', err);
        });
      }

      // Show celebration animation immediately
      setTimeout(() => {
        setShowCelebration(true);
      }, 500);
      
    } catch (error: any) {
      console.error('Error submitting test:', error);
      alert(`Error submitting test: ${error.message}`);
      setIsSubmitting(false);
      setTestCompleted(false);
    }
  };

  const handleAutoSubmit = (reason: string) => {
    if (!isSubmitting && !testCompleted && !viewMode) {
      console.log(`Auto-submitting test: ${reason}`);
      setAutoSubmittedDueToViolation(true);
      handleSubmitTest();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getGrade = () => {
    const percentage = (finalScore / totalQuestions) * 100;
    
    // Special handling for violation-based submissions
    if (autoSubmittedDueToViolation) {
      return { 
        grade: 'F', 
        label: 'Test Terminated - Security Violations', 
        color: 'text-red-600' 
      };
    }
    
    if (percentage >= 90) return { grade: 'A+', label: 'Outstanding', color: 'text-green-600' };
    if (percentage >= 80) return { grade: 'A', label: 'Exceptional Performance!', color: 'text-green-600' };
    if (percentage >= 70) return { grade: 'B+', label: 'Great Job!', color: 'text-blue-600' };
    if (percentage >= 60) return { grade: 'B', label: 'Good Work!', color: 'text-yellow-600' };
    if (percentage >= 50) return { grade: 'C', label: 'Keep Improving!', color: 'text-orange-600' };
    return { grade: 'D', label: 'Better Luck Next Time!', color: 'text-red-600' };
  };

  const getAnswerStatus = (questionIndex: number, optionIndex: number) => {
    const userAnswer = answers[questionIndex];
    const correctAnswer = selectedQuestions[questionIndex].correctAnswer;
    
    if (optionIndex === correctAnswer) {
      return 'correct'; // This is the correct answer
    } else if (optionIndex === userAnswer && userAnswer !== correctAnswer) {
      return 'wrong'; // User selected this wrong answer
    }
    return 'neutral'; // Neither correct nor user's wrong answer
  };

  // Get current question safely
  const currentQuestion = selectedQuestions[currentQuestionIndex];

  // Compact Celebration Modal - Fits in page
  const CelebrationModal = () => {
    const gradeInfo = getGrade();
    const percentage = Math.round((finalScore / totalQuestions) * 100);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        {/* Subtle Background Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Minimal floating particles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute w-1 h-1 bg-white/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random()}s`
              }}
            />
          ))}
        </div>

        {/* Compact Results Card */}
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden relative">
          {/* Header Section */}
          <div className={`px-6 py-4 text-center text-white ${
            autoSubmittedDueToViolation 
              ? 'bg-gradient-to-r from-red-500 to-red-600' 
              : 'bg-gradient-to-r from-emerald-500 to-teal-500'
          }`}>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              {autoSubmittedDueToViolation ? (
                <AlertTriangle className="h-6 w-6 text-white" />
              ) : (
                <Trophy className="h-6 w-6 text-white" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-1">
              {autoSubmittedDueToViolation ? 'Test Terminated' : 'Assessment Complete'}
            </h2>
            <p className="text-emerald-100 text-sm truncate">{experiment?.title}</p>
            {autoSubmittedDueToViolation && (
              <p className="text-red-100 text-xs mt-2 font-medium">
                Due to Security Violations
              </p>
            )}
          </div>

          {/* Score Section */}
          <div className="px-6 py-5">
            {/* Violation Warning Message */}
            {autoSubmittedDueToViolation && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-semibold text-red-800">Security Violation Detected</span>
                </div>
                <p className="text-sm text-red-700 mb-2">
                  Your test was automatically submitted due to multiple security violations.
                </p>
                <div className="text-xs text-red-600 space-y-1">
                  <div>• Tab Switches: {securityViolations.tabSwitches}</div>
                  <div>• Window Switches: {securityViolations.windowSwitches}</div>
                  <div>• AI Tool Detections: {securityViolations.aiToolDetections}</div>
                  <div>• DevTools Attempts: {securityViolations.devToolsAttempts}</div>
                  {aiToolsDetected.length > 0 && (
                    <div>• AI Tools Detected: {aiToolsDetected.join(', ')}</div>
                  )}
                </div>
                <p className="text-sm font-semibold text-red-800 mt-3">
                  Score: 0/{totalQuestions} (Automatic penalty for violations)
                </p>
              </div>
            )}

            <div className="text-center mb-5">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg ${
                autoSubmittedDueToViolation 
                  ? 'bg-gradient-to-br from-red-400 to-red-500' 
                  : 'bg-gradient-to-br from-emerald-400 to-teal-500'
              }`}>
                <span className="text-2xl font-bold text-white">{percentage}%</span>
              </div>
              <div className="mb-1">
                <span className="text-xl font-bold text-gray-800">Grade: {gradeInfo.grade}</span>
              </div>
              <div className="text-gray-600 text-sm">{gradeInfo.label}</div>
            </div>

            {/* Performance Breakdown */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-800 text-sm">Performance Breakdown</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Correct Answers</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          autoSubmittedDueToViolation ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(finalScore / totalQuestions) * 100}%` }}
                      ></div>
                    </div>
                    <span className={`font-medium text-sm ${
                      autoSubmittedDueToViolation ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {finalScore}/{totalQuestions}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Accuracy Rate</span>
                  <span className={`font-medium text-sm ${
                    autoSubmittedDueToViolation ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {percentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Compact Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className={`text-center p-3 rounded-lg ${
                autoSubmittedDueToViolation ? 'bg-red-50' : 'bg-emerald-50'
              }`}>
                {autoSubmittedDueToViolation ? (
                  <X className="h-5 w-5 text-red-600 mx-auto mb-1" />
                ) : (
                  <Check className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                )}
                <div className={`text-lg font-bold ${
                  autoSubmittedDueToViolation ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  {finalScore}
                </div>
                <div className={`text-xs ${
                  autoSubmittedDueToViolation ? 'text-red-700' : 'text-emerald-700'
                }`}>
                  Correct
                </div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <X className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-red-600">{totalQuestions - finalScore}</div>
                <div className="text-xs text-red-700">Incorrect</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Target className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-blue-600">{totalQuestions}</div>
                <div className="text-xs text-blue-700">Total</div>
              </div>
            </div>

            {/* Action Button */}
            <div className="text-center">
              {viewMode ? (
                <button
                  onClick={onCancel}
                  className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Experiments</span>
                </button>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-gray-500 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Redirecting in {celebrationTimer} seconds...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (showCelebration) {
    return <CelebrationModal />;
  }

  // Show loading state while fetching questions
  if (!experiment || selectedQuestions.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Viva Test</h2>
            <p className="text-gray-600">
              {!experiment ? 'Loading experiment details...' : 'Loading questions...'}
            </p>
            {totalQuestions === 0 && experiment && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  No viva questions found for this experiment. Please contact your faculty.
                </p>
                <button
                  onClick={onCancel}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!hasStarted && !viewMode) {
    const totalViolations = Object.values(securityViolations).reduce((sum, count) => sum + count, 0);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-lg max-w-3xl w-full p-8 my-8 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-8">
            <div className="bg-blue-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Shield className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Secure Viva Test: {experiment?.title}
            </h2>
            <p className="text-gray-600">
              You are about to start a monitored viva test with enhanced security. You will get exactly {Math.min(allQuestions.length, 10)} questions.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-2">🔒 ENHANCED SECURITY MONITORING:</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• <strong>Tab Switching:</strong> Switching tabs will be detected</li>
                  <li>• <strong>Window Switching:</strong> Alt+Tab, Cmd+Tab, and window focus changes monitored</li>
                  <li>• <strong>AI Tool Detection:</strong> ChatGPT, Claude, Bard, Copilot, and other AI tools detected</li>
                  <li>• <strong>Developer Tools:</strong> F12, Inspect Element, Console access blocked</li>
                  <li>• <strong>Copy/Paste:</strong> Clipboard operations disabled</li>
                  <li>• <strong>Screenshots:</strong> Print Screen and screen capture blocked</li>
                  <li>• <strong>Right-Click:</strong> Context menu disabled</li>
                  <li>• <strong>Mouse Tracking:</strong> Mouse leaving test area monitored</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <Clock className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800 mb-2">📋 TEST INFORMATION:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Total Questions: {Math.min(allQuestions.length, 10)} (Maximum 10 questions)</li>
                  <li>• Time Limit: {Math.min(allQuestions.length, 10)} minutes (1 minute per question)</li>
                  <li>• Each correct answer carries 1 mark</li>
                  {allQuestions.length > 10 && (
                    <li>• Questions are randomly selected from the question bank</li>
                  )}
                  <li>• Test will enter fullscreen mode for security</li>
                  <li>• Once started, you cannot pause the test</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <Eye className="h-6 w-6 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-800 mb-2">⚠️ VIOLATION POLICY:</h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• <strong>1st Violation:</strong> Warning message displayed</li>
                  <li>• <strong>2nd Violation:</strong> Test automatically submitted with 0 marks</li>
                  <li>• All violations are logged and reported to faculty</li>
                  <li>• AI tool usage will result in immediate test termination</li>
                  <li>• <strong>Zero tolerance:</strong> Any cheating attempt results in 0 marks</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartTest}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Shield className="h-5 w-5" />
              <span>I Understand - Start Secure Test</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add safety check for current question
  if (!currentQuestion) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Error</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the test questions.
            </p>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalViolations = Object.values(securityViolations).reduce((sum, count) => sum + count, 0);

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Enhanced Warning Banner */}
      {showWarning && !viewMode && (
        <div className="bg-red-600 text-white p-4 text-center font-semibold animate-pulse border-b-4 border-red-800">
          <div className="flex items-center justify-center space-x-2">
            <AlertTriangle className="h-6 w-6" />
            <span className="text-lg">{warningMessage}</span>
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      )}

      {/* Header with Enhanced Security Status */}
      <div className="bg-white border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {viewMode ? 'Viva Test Results' : 'Secure Viva Test'}: {experiment?.title}
            </h1>
            <p className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {selectedQuestions.length}
              {viewMode && (
                <span className="ml-4 text-green-600 font-semibold">
                  Score: {finalScore}/{totalQuestions} ({Math.round((finalScore / totalQuestions) * 100)}%)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {viewMode ? (
              <button
                onClick={onCancel}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            ) : (
              <>
                {/* Security Status Panel */}
                <div className="flex items-center space-x-4 bg-gray-50 rounded-lg px-4 py-2 border">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-4 w-4 ${totalViolations === 0 ? 'text-green-500' : totalViolations < 3 ? 'text-yellow-500' : 'text-red-500'}`} />
                    <span className="text-sm font-medium">Security Status</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex space-x-3">
                      <span className={`${securityViolations.tabSwitches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Tabs: {securityViolations.tabSwitches}
                      </span>
                      <span className={`${securityViolations.windowSwitches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        Windows: {securityViolations.windowSwitches}
                      </span>
                      <span className={`${securityViolations.aiToolDetections > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        AI: {securityViolations.aiToolDetections}
                      </span>
                      <span className={`${securityViolations.devToolsAttempts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        DevTools: {securityViolations.devToolsAttempts}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className={`font-bold ${totalViolations < 3 ? 'text-gray-600' : 'text-red-600'}`}>
                        Total Violations: {totalViolations}/2
                      </span>
                    </div>
                  </div>
                </div>

                {/* Window Focus Indicator */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                  isWindowFocused ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isWindowFocused ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium">
                    {isWindowFocused ? 'Focused' : 'Not Focused'}
                  </span>
                </div>

                {/* Timer */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                  timeLeft <= 300 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-bold">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  viewMode ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  Question {currentQuestionIndex + 1}
                  {viewMode && (
                    <span className="ml-2">
                      {answers[currentQuestionIndex] === currentQuestion?.correctAnswer ? '✓' : '✗'}
                    </span>
                  )}
                </span>
                <span className="text-sm text-gray-500">1 Mark</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {currentQuestion?.question}
              </h2>
            </div>

            <div className="space-y-3 mb-8">
              {currentQuestion?.options.map((option, index) => {
                const answerStatus = viewMode ? getAnswerStatus(currentQuestionIndex, index) : null;
                const isSelected = answers[currentQuestionIndex] === index;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={viewMode}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      viewMode
                        ? answerStatus === 'correct'
                          ? 'border-green-500 bg-green-50'
                          : answerStatus === 'wrong'
                          ? 'border-red-500 bg-red-50'
                          : isSelected
                          ? 'border-gray-400 bg-gray-50'
                          : 'border-gray-200 bg-white'
                        : isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                    } ${viewMode ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        viewMode
                          ? answerStatus === 'correct'
                            ? 'border-green-500 bg-green-500'
                            : answerStatus === 'wrong'
                            ? 'border-red-500 bg-red-500'
                            : isSelected
                            ? 'border-gray-400 bg-gray-400'
                            : 'border-gray-300'
                          : isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {viewMode ? (
                          answerStatus === 'correct' ? (
                            <Check className="h-4 w-4 text-white" />
                          ) : answerStatus === 'wrong' ? (
                            <X className="h-4 w-4 text-white" />
                          ) : isSelected ? (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          ) : null
                        ) : (
                          isSelected && <Check className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-gray-700">
                        {String.fromCharCode(65 + index)}.
                      </span>
                      <span className="text-gray-900">{option}</span>
                      {viewMode && answerStatus === 'correct' && (
                        <span className="ml-auto text-green-600 font-semibold">Correct Answer</span>
                      )}
                      {viewMode && answerStatus === 'wrong' && (
                        <span className="ml-auto text-red-600 font-semibold">Your Answer</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>
                  {viewMode 
                    ? `${currentQuestionIndex + 1}/${selectedQuestions.length} questions`
                    : `${answers.filter(a => a !== -1).length}/${selectedQuestions.length} answered`
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    viewMode ? 'bg-purple-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${((currentQuestionIndex + 1) / selectedQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <div className="flex space-x-2">
                {!viewMode && currentQuestionIndex === selectedQuestions.length - 1 ? (
                  <div className="flex flex-col items-center">
                    <button
                      onClick={handleSubmitTest}
                      disabled={isSubmitting || testCompleted || answers.includes(-1)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Submit Test</span>
                        </>
                      )}
                    </button>
                    {answers.includes(-1) && (
                      <p className="text-xs text-red-600 mt-2">Please answer all questions before submitting</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    disabled={currentQuestionIndex === selectedQuestions.length - 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VivaTest;