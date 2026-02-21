import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, X, CheckCircle, Users, UserMinus, Download, Database, Search, Pencil, Trash2, ChevronLeft, ChevronRight, MessageSquare, Loader2, Send, XCircle, Bot } from "lucide-react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Toaster, toast } from "react-hot-toast";

export default function App() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dashboardData, setDashboardData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/churn-data");
      setDashboardData(response.data);
    } catch (error) {
      toast.error("Failed to fetch dashboard data");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"]
    }
  });

  const removeFile = (fileToRemove) => {
    setFiles(files.filter(file => file !== fileToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      await axios.post("http://localhost:8000/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        }
      });
      setFiles([]);
      fetchDashboardData();
      toast.success("Files successfully processed");
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleExport = () => {
    window.open("http://localhost:8000/export", "_blank");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await axios.delete(`http://localhost:8000/api/churn-data/${id}`);
      toast.success("Record deleted successfully");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to delete record");
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await axios.put(`http://localhost:8000/api/churn-data/${id}`, data);
      toast.success("Record updated successfully");
      setEditingId(null);
      setEditForm({});
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to update record");
    }
  };

  const startEditing = (row) => {
    setEditingId(row.id);
    setEditForm({
      employee_id: row.employee_id || "",
      department: row.department || "",
      exit_reason: row.exit_reason || "",
      salary: row.salary || ""
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleChat = async () => {
    if (!chatQuestion.trim()) return;
    setIsChatLoading(true);
    setChatResponse("");
    try {
      const response = await axios.post("http://localhost:8000/api/chat", {
        question: chatQuestion,
        data: dashboardData
      });
      setChatResponse(response.data.response);
    } catch (error) {
      toast.error("Failed to get AI response");
      setChatResponse("An error occurred while processing your question.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const totalEmployees = dashboardData.length;
  const totalChurn = dashboardData.filter(d => d.churn_flag).length;

  const churnByDepartment = dashboardData.reduce((acc, curr) => {
    const dept = curr.department || "Unknown";
    if (!acc[dept]) {
      acc[dept] = { department: dept, churned: 0, retained: 0 };
    }
    if (curr.churn_flag) {
      acc[dept].churned += 1;
    } else {
      acc[dept].retained += 1;
    }
    return acc;
  }, {});

  const chartData = Object.values(churnByDepartment);

  const filteredData = dashboardData.filter((row) => {
    const term = searchTerm.toLowerCase();
    return (
      (row.employee_id && row.employee_id.toLowerCase().includes(term)) ||
      (row.department && row.department.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Toaster position="top-right" />
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
            Sample HR Intelligence
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-medium text-sm transition-colors border border-indigo-100"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-4">
            Employee Churn Analytics
          </h1>
          <p className="text-lg text-slate-600">
            Automatically process unstructured exit interviews, performance reviews, and HR spreadsheets using OCR and LLMs to generate actionable retention insights.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <UploadCloud className="w-5 h-5 mr-2 text-blue-500" />
                Data Ingestion
              </h2>
              
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 flex-1 min-h-[250px]
                  ${isDragActive ? "border-blue-500 bg-blue-50 ring-4 ring-blue-50" : "border-slate-300 hover:border-blue-400 bg-slate-50"}
                  ${isDragReject ? "border-red-500 bg-red-50" : ""}
                `}
              >
                <input {...getInputProps()} />
                <div className={`p-4 rounded-full mb-4 ${isDragActive ? "bg-blue-100 text-blue-600" : "bg-white shadow-sm border border-slate-200 text-slate-400"}`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-base text-slate-700 text-center font-medium mb-1">
                  {isDragActive ? "Drop files to begin" : "Drag & drop files here"}
                </p>
                <p className="text-sm text-slate-500 text-center">
                  or click to browse from your computer
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">PDF</span>
                  <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">XLSX</span>
                  <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">CSV</span>
                  <span className="text-xs font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">JPG</span>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-slate-700">Ready to Process ({files.length})</span>
                    <button onClick={() => setFiles([])} className="text-xs text-slate-500 hover:text-red-600">Clear All</button>
                  </div>
                  
                  <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md p-3 group hover:border-blue-200 transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <File className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate font-medium">{file.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-slate-500 flex-shrink-0">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <button 
                            onClick={() => removeFile(file)}
                            disabled={isUploading}
                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 pt-5 border-t border-slate-100">
                    {isUploading ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-slate-600">
                          <span className="flex items-center"><span className="animate-pulse h-2 w-2 bg-blue-600 rounded-full mr-2"></span>Extracting & Modeling Data...</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleUpload}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors shadow-sm flex items-center justify-center"
                      >
                        <Database className="w-4 h-4 mr-2" />
                        Process Documents
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 bg-indigo-50 rounded-full p-8 transition-transform group-hover:scale-110"></div>
                <Users className="w-6 h-6 text-indigo-600 mb-4 relative z-10" />
                <p className="text-sm font-medium text-slate-500 relative z-10">Analyzed Profiles</p>
                <div className="mt-1 flex items-baseline relative z-10">
                  <h3 className="text-3xl font-bold text-slate-900">{totalEmployees}</h3>
                  <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Valid</span>
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute right-0 top-0 -mt-4 -mr-4 bg-rose-50 rounded-full p-8 transition-transform group-hover:scale-110"></div>
                <UserMinus className="w-6 h-6 text-rose-600 mb-4 relative z-10" />
                <p className="text-sm font-medium text-slate-500 relative z-10">Recorded Churn</p>
                <div className="mt-1 flex items-baseline relative z-10">
                  <h3 className="text-3xl font-bold text-slate-900">{totalChurn}</h3>
                  <span className="ml-2 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    {totalEmployees ? Math.round((totalChurn / totalEmployees) * 100) : 0}% Rate
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex-1 flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800">Retention by Department</h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Live Output</span>
              </div>
              
              <div className="flex-1 w-full min-h-0">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="department" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        dx={-10}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0', 
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          padding: '12px'
                        }}
                        itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                        labelStyle={{ color: '#0f172a', fontWeight: 600, marginBottom: '8px' }}
                      />
                      <Bar dataKey="retained" stackId="a" fill="#6366f1" name="Retained" radius={[0, 0, 4, 4]} maxBarSize={50} />
                      <Bar dataKey="churned" stackId="a" fill="#f43f5e" name="Churned" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                    <BarChart className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm font-medium">No analytics available.</p>
                    <p className="text-xs mt-1">Process HR documents to generate insights.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-lg font-semibold text-slate-800">Consolidated Records</h3>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
              {filteredData.length} records found
            </span>
          </div>

          <div className="px-6 py-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Employee ID or Department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Employee ID</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Department</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Joining Date</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Exit Date</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Exit Reason</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Salary</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.length > 0 ? (
                  paginatedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {editingId === row.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.employee_id}
                              onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.department}
                              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">{row.joining_date || '-'}</td>
                          <td className="px-6 py-4">{row.exit_date || '-'}</td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.exit_reason}
                              onChange={(e) => setEditForm({ ...editForm, exit_reason: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.salary}
                              onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            {row.churn_flag ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Churned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleUpdate(row.id, {
                                  employee_id: editForm.employee_id || null,
                                  department: editForm.department || null,
                                  exit_reason: editForm.exit_reason || null,
                                  salary: editForm.salary ? parseFloat(editForm.salary) : null
                                })}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-slate-900">{row.employee_id}</td>
                          <td className="px-6 py-4">{row.department || '-'}</td>
                          <td className="px-6 py-4">{row.joining_date || '-'}</td>
                          <td className="px-6 py-4">{row.exit_date || '-'}</td>
                          <td className="px-6 py-4 max-w-xs truncate" title={row.exit_reason}>
                            {row.exit_reason || '-'}
                          </td>
                          <td className="px-6 py-4">{row.salary != null ? `$${row.salary.toLocaleString()}` : '-'}</td>
                          <td className="px-6 py-4">
                            {row.churn_flag ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Churned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-3">
                              <button
                                onClick={() => startEditing(row)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(row.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      No records available in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredData.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <p className="text-sm text-slate-600">
                Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredData.length)} of {filteredData.length} records
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <span className="text-sm font-medium text-slate-700 px-3">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 z-50"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsChatOpen(false)}
          />
          <div className="relative w-full max-w-[33vw] bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">HR AI Assistant</h3>
                  <p className="text-xs text-blue-100">Powered by Llama 3.1</p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium">Welcome! Ask me anything about your employee churn data.</p>
                <p className="text-xs text-blue-600 mt-1">I can analyze trends, identify patterns, and provide HR insights based on your uploaded records.</p>
              </div>

              {isChatLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Analyzing your data...</p>
                  </div>
                </div>
              )}

              {chatResponse && !isChatLoading && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center space-x-2 mb-3">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">AI Response</span>
                  </div>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{chatResponse}</div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleChat(); }}
                  placeholder="Ask about your HR data..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  disabled={isChatLoading}
                />
                <button
                  onClick={handleChat}
                  disabled={isChatLoading || !chatQuestion.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                  <span>Ask</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
