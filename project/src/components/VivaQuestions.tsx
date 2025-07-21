import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MessageSquare, Upload, FileText, Download, AlertCircle, Check, X, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VivaQuestion, Experiment } from '../types';

const VivaQuestions: React.FC = () => {
  const { userProfile } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [questions, setQuestions] = useState<VivaQuestion[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<VivaQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0
  });

  useEffect(() => {
    fetchExperiments();
  }, [userProfile]);

  useEffect(() => {
    if (selectedExperiment) {
      fetchQuestions();
    }
  }, [selectedExperiment]);

  const fetchExperiments = async () => {
    if (!userProfile) return;

    // Determine which faculty's experiments to fetch
    const targetFacultyId = userProfile.primaryFacultyId || userProfile.uid;

    try {
      const q = query(
        collection(db, 'experiments'),
        where('facultyId', '==', targetFacultyId)
      );
      const querySnapshot = await getDocs(q);
      const experimentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Experiment[];

      setExperiments(experimentsData);
    } catch (error) {
      console.error('Error fetching experiments:', error);
    }
  };

  const fetchQuestions = async () => {
    if (!selectedExperiment) return;

    try {
      const q = query(
        collection(db, 'vivaQuestions'),
        where('experimentId', '==', selectedExperiment)
      );
      const querySnapshot = await getDocs(q);
      const questionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VivaQuestion[];

      setQuestions(questionsData);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExperiment) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'vivaQuestions'), {
        experimentId: selectedExperiment,
        question: formData.question,
        options: formData.options,
        correctAnswer: formData.correctAnswer,
        facultyId: userProfile!.primaryFacultyId || userProfile!.uid
      });

      setFormData({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
      setShowAddModal(false);
      fetchQuestions();
      alert('Question added successfully!');
    } catch (error: any) {
      console.error('Error adding question:', error);
      alert(`Error adding question: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'vivaQuestions', editingQuestion.id), {
        question: formData.question,
        options: formData.options,
        correctAnswer: formData.correctAnswer
      });

      setEditingQuestion(null);
      setFormData({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
      fetchQuestions();
      alert('Question updated successfully!');
    } catch (error: any) {
      console.error('Error updating question:', error);
      alert(`Error updating question: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await deleteDoc(doc(db, 'vivaQuestions', questionId));
      fetchQuestions();
      alert('Question deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting question:', error);
      alert(`Error deleting question: ${error.message}`);
    }
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please select a valid CSV file');
      return;
    }

    setCsvFile(file);
    parseCSVFile(file);
  };

  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setCsvErrors(['CSV file must contain at least a header row and one data row']);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const expectedHeaders = ['serialno', 'question', 'a', 'b', 'c', 'd', 'correctanswer'];
      
      // Validate headers
      const headerErrors: string[] = [];
      expectedHeaders.forEach(expectedHeader => {
        if (!headers.includes(expectedHeader)) {
          headerErrors.push(`Missing column: ${expectedHeader}`);
        }
      });

      if (headerErrors.length > 0) {
        setCsvErrors(headerErrors);
        return;
      }

      // Parse data rows
      const parsedData: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== headers.length) {
          errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
          continue;
        }

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index];
        });

        // Validate required fields
        if (!rowData.question || !rowData.a || !rowData.b || !rowData.c || !rowData.d) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Validate correct answer
        const correctAnswer = rowData.correctanswer.toLowerCase();
        if (!['a', 'b', 'c', 'd', '0', '1', '2', '3'].includes(correctAnswer)) {
          errors.push(`Row ${i + 1}: Correct answer must be A, B, C, D or 0, 1, 2, 3`);
          continue;
        }

        // Convert correct answer to index
        let correctIndex = 0;
        if (['a', '0'].includes(correctAnswer)) correctIndex = 0;
        else if (['b', '1'].includes(correctAnswer)) correctIndex = 1;
        else if (['c', '2'].includes(correctAnswer)) correctIndex = 2;
        else if (['d', '3'].includes(correctAnswer)) correctIndex = 3;

        parsedData.push({
          serialNo: rowData.serialno,
          question: rowData.question,
          options: [rowData.a, rowData.b, rowData.c, rowData.d],
          correctAnswer: correctIndex,
          originalCorrectAnswer: rowData.correctanswer
        });
      }

      setCsvErrors(errors);
      setCsvPreview(parsedData);
    };

    reader.readAsText(file);
  };

  const handleCSVUpload = async () => {
    if (!selectedExperiment || csvPreview.length === 0) return;

    setLoading(true);
    try {
      const uploadPromises = csvPreview.map(questionData => 
        addDoc(collection(db, 'vivaQuestions'), {
          experimentId: selectedExperiment,
          question: questionData.question,
          options: questionData.options,
          correctAnswer: questionData.correctAnswer,
          facultyId: userProfile!.primaryFacultyId || userProfile!.uid
        })
      );

      await Promise.all(uploadPromises);
      
      setCsvFile(null);
      setCsvPreview([]);
      setCsvErrors([]);
      setShowCSVModal(false);
      fetchQuestions();
      alert(`Successfully uploaded ${csvPreview.length} questions!`);
    } catch (error: any) {
      console.error('Error uploading CSV questions:', error);
      alert(`Error uploading questions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = `serialno,question,a,b,c,d,correctanswer
1,"What is the capital of France?","Paris","London","Berlin","Madrid","a"
2,"Which planet is closest to the Sun?","Venus","Mercury","Earth","Mars","b"
3,"What is 2 + 2?","3","4","5","6","b"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'viva_questions_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const openEditModal = (question: VivaQuestion) => {
    setEditingQuestion(question);
    setFormData({
      question: question.question,
      options: [...question.options],
      correctAnswer: question.correctAnswer
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowCSVModal(false);
    setEditingQuestion(null);
    setCsvFile(null);
    setCsvPreview([]);
    setCsvErrors([]);
    setFormData({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Viva Questions Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={downloadCSVTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700 transition-colors"
          >
            <Download className="h-5 w-5" />
            <span>Download Template</span>
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            disabled={!selectedExperiment}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="h-5 w-5" />
            <span>Upload CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!selectedExperiment}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Experiment Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-4 mb-4">
          <BookOpen className="h-6 w-6 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Select Experiment</h2>
        </div>
        
        {experiments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {experiments.map((experiment) => (
              <button
                key={experiment.id}
                onClick={() => setSelectedExperiment(experiment.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedExperiment === experiment.id
                    ? 'border-orange-500 bg-orange-50 shadow-md'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-25'
                }`}
              >
                <h3 className="font-medium text-gray-900 mb-2">{experiment.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{experiment.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Created: {experiment.createdAt.toLocaleDateString()}
                  </span>
                  {selectedExperiment === experiment.id && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No experiments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please create experiments first to add viva questions.
            </p>
          </div>
        )}
      </div>

      {/* Questions List */}
      {selectedExperiment && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-6 w-6 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Viva Questions ({questions.length})
                </h2>
              </div>
              <div className="text-sm text-gray-600">
                {experiments.find(exp => exp.id === selectedExperiment)?.title}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {questions.map((question, index) => (
              <div key={question.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="bg-orange-100 text-orange-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                        Q{index + 1}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {question.question}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`p-3 rounded-lg border ${
                            optionIndex === question.correctAnswer
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                              optionIndex === question.correctAnswer
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-700'
                            }`}>
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-gray-900">{option}</span>
                            {optionIndex === question.correctAnswer && (
                              <Check className="h-4 w-4 text-green-600 ml-auto" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-sm text-green-600 font-medium">
                      Correct Answer: {String.fromCharCode(65 + question.correctAnswer)} - {question.options[question.correctAnswer]}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => openEditModal(question)}
                      className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {questions.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No questions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add viva questions for this experiment using the buttons above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Question Modal */}
      {(showAddModal || editingQuestion) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={editingQuestion ? handleEditQuestion : handleAddQuestion} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter the viva question"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Answer Options
                </label>
                <div className="space-y-3">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <input
                        type="text"
                        required
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      />
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={formData.correctAnswer === index}
                        onChange={() => setFormData({ ...formData, correctAnswer: index })}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select the radio button next to the correct answer
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingQuestion ? 'Update' : 'Add'} Question</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Upload Questions via CSV</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* CSV Format Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">CSV Format Requirements:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>Columns:</strong> serialno, question, a, b, c, d, correctanswer</li>
                      <li>• <strong>Correct Answer:</strong> Use A, B, C, D or 0, 1, 2, 3</li>
                      <li>• <strong>No empty cells</strong> in required columns</li>
                      <li>• <strong>First row</strong> must contain column headers</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Errors Display */}
              {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 mb-2">Errors Found:</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {csvErrors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              {csvPreview.length > 0 && csvErrors.length === 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Preview ({csvPreview.length} questions)
                  </h4>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Options</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Correct</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvPreview.slice(0, 5).map((question, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{question.serialNo}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                              {question.question}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              A: {question.options[0].substring(0, 20)}...
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-green-600">
                              {String.fromCharCode(65 + question.correctAnswer)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 5 && (
                      <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                        ... and {csvPreview.length - 5} more questions
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCSVUpload}
                  disabled={loading || csvPreview.length === 0 || csvErrors.length > 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload {csvPreview.length} Questions</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VivaQuestions;