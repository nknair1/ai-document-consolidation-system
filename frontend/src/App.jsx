import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, X, CheckCircle, Users, UserMinus, Download } from "lucide-react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function App() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dashboardData, setDashboardData] = useState([]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get("http://localhost:8000/api/churn-data");
      setDashboardData(response.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
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
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleExport = () => {
    window.open("http://localhost:8000/export", "_blank");
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-8 space-y-8">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Document Consolidation System</h1>
        
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 ease-in-out
            ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 bg-gray-50"}
            ${isDragReject ? "border-red-500 bg-red-50" : ""}
          `}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? "text-blue-500" : "text-gray-400"}`} />
          <p className="text-lg text-gray-600 text-center font-medium">
            {isDragActive ? "Drop the files here..." : "Drag & drop files here, or click to select"}
          </p>
          <p className="text-sm text-gray-400 mt-2 text-center">
            Supported formats: PDF, Excel (.xls, .xlsx), CSV, JPG, PNG, ZIP
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
              Selected Files ({files.length})
            </h2>
            <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md p-3">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <File className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button 
                      onClick={() => removeFile(file)}
                      disabled={isUploading}
                      className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {isUploading && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Uploading and processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUploading ? (
                  "Processing..."
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Upload and Process
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">KPI Dashboard</h2>
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export to Excel
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 flex items-center">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-semibold mb-1">Total Employees</p>
              <h3 className="text-3xl font-bold text-gray-800">{totalEmployees}</h3>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-100 rounded-lg p-6 flex items-center">
            <div className="bg-red-100 p-3 rounded-full mr-4">
              <UserMinus className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600 font-semibold mb-1">Total Churn</p>
              <h3 className="text-3xl font-bold text-gray-800">{totalChurn}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border text-gray-700 border-gray-100 rounded-lg p-4 h-80">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">Churn by Department</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="department" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                />
                <Bar dataKey="retained" stackId="a" fill="#3B82F6" name="Retained" radius={[0, 0, 4, 4]} />
                <Bar dataKey="churned" stackId="a" fill="#EF4444" name="Churned" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-gray-400">
                No data available. Upload files to generate insights.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
