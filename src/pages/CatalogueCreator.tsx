import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Search, Edit, Trash2, Plus, Image, Box, Tag, IndianRupee, X, Upload, Loader2, Sparkles, FileDown, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { downloadCartPdf } from '../utils/generatePdf';
import PrintFieldLogo from '../components/PrintFieldLogo';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

type CatalogueItem = {
  id: string;
  brandName: string;
  name: string;
  description: string;
  price: number;
  purchasePrice?: number;
  sellingPrice?: number;
  gstRate?: number;
  category: string;
  imageUrl?: string;
  sizes?: string[];
};

interface CatalogueCreatorProps {
  isEmbedded?: boolean;
}

export default function CatalogueCreator({ isEmbedded = false }: CatalogueCreatorProps) {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState("");

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const [descWarning, setDescWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<CatalogueItem, 'id'>>({
    brandName: '',
    name: '',
    description: '',
    price: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    gstRate: 0,
    category: '',
    imageUrl: ''
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [cart, setCart] = useState<(CatalogueItem & { selectedSize?: string })[]>([]);
  const [sizeModalItem, setSizeModalItem] = useState<CatalogueItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [bulkTotal, setBulkTotal] = useState(0);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  
  const toggleCart = (item: CatalogueItem) => {
    if (cart.some(c => c.id === item.id)) {
      setCart(cart.filter(c => c.id !== item.id));
    } else {
      if (item.sizes && item.sizes.length > 0) {
        setSizeModalItem(item);
        setSelectedSize(item.sizes[0]);
      } else {
        setCart([...cart, item]);
      }
    }
  };

  const confirmAddToCartWithSize = () => {
    if (!sizeModalItem) return;
    setCart([...cart, { ...sizeModalItem, selectedSize }]);
    setSizeModalItem(null);
    setSelectedSize('');
  };


  useEffect(() => {
    const loadCatalogue = async () => {
      try {
        const response = await fetch('/api/catalogue-items');
        if (response.ok) {
          const data = await response.json();
          setItems(data);
          localStorage.setItem('catalogue_items', JSON.stringify(data));
          return;
        }
      } catch (e) {
        console.error("Failed to fetch catalogue items from server, falling back to local storage", e);
      }

      // Fallback
      const saved = localStorage.getItem('catalogue_items');
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load catalogue items from local storage", e);
        }
      }
    };

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
          localStorage.setItem('catalogue_categories', JSON.stringify(data));
          return;
        }
      } catch (e) {
        console.error("Failed to fetch categories from server, falling back to local storage", e);
      }

      const saved = localStorage.getItem('catalogue_categories');
      if (saved) {
        try {
          setCategories(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load categories from local storage", e);
        }
      } else {
        const defaultCats = ["Mugs", "T-Shirts", "Notebooks", "Water Bottles", "Business Cards", "Flyers", "Posters", "Banners"];
        setCategories(defaultCats);
      }
    };

    loadCatalogue();
    loadCategories();
  }, []);

  const handleAddCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;

    const exists = categories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      localStorage.setItem('catalogue_categories', JSON.stringify(updated));

      try {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: trimmed })
        });
      } catch (e) {
        console.error("Failed to save new category to server:", e);
      }
    }

    setFormData(prev => ({ ...prev, category: trimmed }));
    setShowAddCategoryInput(false);
    setNewCategoryName('');
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category) return;
    
    const updatedData = {
      ...formData,
      price: Number(formData.sellingPrice) || Number(formData.price) || 0,
      sellingPrice: Number(formData.sellingPrice) || Number(formData.price) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0,
      gstRate: Number(formData.gstRate) || 0
    };
    
    try {
      if (editingItem) {
        const response = await fetch(`/api/catalogue-items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
        if (response.ok) {
          const updatedItem = await response.json();
          const updated = items.map(item => item.id === editingItem.id ? updatedItem : item);
          setItems(updated);
          localStorage.setItem('catalogue_items', JSON.stringify(updated));
        } else {
          throw new Error('Server returned error on update');
        }
      } else {
        const response = await fetch('/api/catalogue-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
        if (response.ok) {
          const newItem = await response.json();
          const updated = [...items, newItem];
          setItems(updated);
          localStorage.setItem('catalogue_items', JSON.stringify(updated));
        } else {
          throw new Error('Server returned error on create');
        }
      }
    } catch (error) {
      console.error("Failed to save catalogue item on server, falling back to local storage only", error);
      // Fallback local storage saving
      if (editingItem) {
        const updated = items.map(item => item.id === editingItem.id ? { ...updatedData, id: item.id } as CatalogueItem : item);
        setItems(updated);
        localStorage.setItem('catalogue_items', JSON.stringify(updated));
      } else {
        const newItem = { ...updatedData, id: crypto.randomUUID() } as CatalogueItem;
        const updated = [...items, newItem];
        setItems(updated);
        localStorage.setItem('catalogue_items', JSON.stringify(updated));
      }
    }
    
    if (bulkQueue.length > 1) {
      const nextQueue = bulkQueue.slice(1);
      setBulkQueue(nextQueue);
      processNextBulkItem(nextQueue);
    } else {
      if (bulkQueue.length === 1) {
        setBulkQueue([]);
        setBulkTotal(0);
      }
      closeModal();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/catalogue-items/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const updated = items.filter(item => item.id !== id);
        setItems(updated);
        localStorage.setItem('catalogue_items', JSON.stringify(updated));
        return;
      }
    } catch (error) {
      console.error("Failed to delete catalogue item on server, falling back to local storage only", error);
    }
    // Fallback
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    localStorage.setItem('catalogue_items', JSON.stringify(updated));
  };

  const openModal = (item?: CatalogueItem, prefillUrl?: string) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        brandName: item.brandName || '',
        name: item.name,
        description: item.description,
        price: item.price,
        purchasePrice: item.purchasePrice !== undefined ? item.purchasePrice : 0,
        sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : item.price,
        gstRate: item.gstRate || 0,
        category: item.category,
        imageUrl: item.imageUrl || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ brandName: '', name: '', description: '', price: 0, purchasePrice: 0, sellingPrice: 0, gstRate: 0, category: '', imageUrl: prefillUrl || '' });
    }
    setIsModalOpen(true);
  };

  const processNextBulkItem = (queue: string[]) => {
    if (queue.length > 0) {
      openModal(undefined, queue[0]);
    }
  };

  
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      alert("Reading and parsing Excel file in browser... This avoids size limits and ignores images.");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        alert("No worksheets found");
        return;
      }

      const items: CatalogueItem[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const brandName = row.getCell(1).text || "";
        const name = row.getCell(2).text || "";
        if (!name) return;
        const description = row.getCell(3).text || "";
        const priceStr = row.getCell(4).text || "0";
        const category = row.getCell(5).text || "Uncategorized";
        const sizesStr = row.getCell(6).text || "";
        
        let sizes: string[] | undefined = sizesStr.split(',').map(s => s.trim()).filter(Boolean);
        if (sizes.length === 0) sizes = undefined;
        
        items.push({
          id: uuidv4(),
          brandName,
          name,
          description,
          price: parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0,
          category,
          sizes,
          imageUrl: "" // Images removed as per request
        });
      });

      if (items.length === 0) {
        alert("No items found in the Excel file.");
        return;
      }

      // Chunk items if there are too many, though 30MB excel without images is probably just a few thousand rows (small JSON)
      const chunkSize = 1000;
      let totalImported = 0;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const response = await fetch('/api/catalogue/bulk-import-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk })
        });
        
        if (response.ok) {
          const data = await response.json();
          totalImported += data.count;
        } else {
          const errText = await response.text();
          alert("Upload failed on chunk: " + errText);
          break;
        }
      }
      
      alert(`Successfully imported ${totalImported} items (images ignored)!`);
      // reload items
      fetch('/api/catalogue-items').then(r => r.json()).then(d => { setItems(d); localStorage.setItem('catalogue_items', JSON.stringify(d)); });
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert("Upload failed: " + error.message);
    }
  };

  
  const handleSheetsImport = async () => {
    if (!sheetsUrl) return;
    
    try {
      setIsUploading(true);
      setUploadError(null);
      const response = await fetch('/api/catalogue/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl })
      });
      
      const data = await response.json();
      if (response.ok) {
        console.log(`Successfully imported ${data.count} items!`);
        setShowSheetsModal(false);
        setSheetsUrl("");
        fetch('/api/catalogue-items').then(r => r.json()).then(d => { setItems(d); localStorage.setItem('catalogue_items', JSON.stringify(d)); });
      } else {
        setUploadError("Import failed: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      setUploadError("Import failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const promise = new Promise<string | null>((resolve) => {
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          try {
            const response = await fetch('/api/upload-s3', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                base64Data: base64Data
              })
            });
            const data = await response.json();
            if (response.ok && data.success) {
              resolve(data.url);
            } else {
              resolve(null);
            }
          } catch (err) {
            resolve(null);
          }
        };
        reader.readAsDataURL(file);
      });
      
      const url = await promise;
      if (url) uploadedUrls.push(url);
    }
    
    setIsUploading(false);
    
    if (uploadedUrls.length > 0) {
      setBulkQueue(uploadedUrls);
      setBulkTotal(uploadedUrls.length);
      processNextBulkItem(uploadedUrls);
    } else {
      setUploadError("Failed to upload any images.");
    }
    
    // Reset input
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];

      try {
        const response = await fetch('/api/upload-s3', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            base64Data: base64Data
          })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setFormData(prev => ({ ...prev, imageUrl: data.url }));
        } else {
          setUploadError(data.error || 'Failed to upload image to S3');
        }
      } catch (err: any) {
        console.error("Upload failed", err);
        setUploadError(err.message || 'An error occurred during S3 upload');
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadError("Failed to read local file");
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setUploadError(null);
    setIsUploading(false);
    setIsGeneratingDesc(false);
    setDescError(null);
    setDescWarning(null);
    setShowAddCategoryInput(false);
    setNewCategoryName('');
    setBulkQueue([]);
    setBulkTotal(0);
  };

  const generateAiDescription = async () => {
    if (!formData.name) {
      alert("Please enter a product name first before generating a description.");
      return;
    }
    
    setIsGeneratingDesc(true);
    setDescError(null);
    setDescWarning(null);
    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: formData.brandName, name: formData.name, category: formData.category, imageUrl: formData.imageUrl })
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, description: data.description }));
        if (data.warning) {
          setDescWarning(data.warning);
        }
      } else {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate description");
      }
    } catch (err: any) {
      console.error("AI Generation error:", err);
      setDescError(err.message || "Failed to generate description");
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const filteredItems = Array.isArray(items) ? items.filter(item => 
    String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (isEmbedded) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catalogue Management</h1>
            <p className="text-slate-500 mt-1">Add, edit, and manage products for the company catalogue</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search items..."
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
                        <button
              onClick={() => {
                if (cart.length > 0) {
                  downloadCartPdf(cart, user, true);
                  setCart([]);
                }
              }}
              disabled={cart.length === 0}
              className={`flex items-center gap-2 text-white px-4 py-2 rounded-md transition-colors whitespace-nowrap ${cart.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-400 cursor-not-allowed'}`}
            >
              <FileDown className="w-4 h-4" />
              Export PDF {cart.length > 0 && <span className="bg-emerald-800 text-xs px-2 py-0.5 rounded-full">{cart.length}</span>}
            </button>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              id="excel-upload"
              onChange={handleExcelUpload} 
            />
            <label 
              htmlFor="excel-upload"
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </label>

            <button 
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
            
            <button 
              onClick={() => setShowSheetsModal(true)}
              disabled={isUploading}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors whitespace-nowrap disabled:bg-green-400"
            >
              <Upload className="w-4 h-4" />
              Import Google Sheet
            </button>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={bulkFileInputRef} onChange={handleBulkImageSelect} 
            />
            <button 
              onClick={() => bulkFileInputRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:bg-indigo-400"
              disabled={isUploading}
            >
              <Image className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Bulk Add Images'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden group">
                {item.imageUrl ? (
                  <img src={item.imageUrl?.includes('amazonaws.com') ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}` : item.imageUrl} alt={item.brandName ? `${item.brandName} ${item.name}` : item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Box className="w-12 h-12 text-slate-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => toggleCart(item)} className={`p-2 rounded-full ${cart.some(c => c.id === item.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-700 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                    {cart.some(c => c.id === item.id) ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
                  </button>
                  <button onClick={() => openModal(item)} className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600 hover:bg-blue-50">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-slate-900 line-clamp-1" title={item.brandName ? `${item.brandName} ${item.name}` : item.name}>{item.brandName ? `${item.brandName} ${item.name}` : item.name}</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    {item.category}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mb-4 line-clamp-3 whitespace-pre-line flex-grow">{item.description}</p>
                <div className="text-sm font-semibold text-slate-900 flex flex-col gap-1 mt-auto">
                  <div className="flex items-center text-emerald-600">
                    <span className="text-xs text-slate-400 mr-1">Sell:</span>
                    <IndianRupee size={14} className="mr-0.5" />
                    {typeof item.sellingPrice === 'number' ? item.sellingPrice.toFixed(2) : (item.price || 0).toFixed(2)}
                    {item.gstRate ? <span className="text-xs text-slate-500 ml-1">+ {item.gstRate}% GST</span> : null}
                  </div>
                  <div className="flex items-center text-slate-500 text-xs">
                    <span className="text-slate-400 mr-1">Cost:</span>
                    <IndianRupee size={12} className="mr-0.5" />
                    {typeof item.purchasePrice === 'number' ? item.purchasePrice.toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-lg border-dashed">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No items found</h3>
              <p className="text-slate-500 mt-1">Try a different search term or add a new item.</p>
            </div>
          )}
        </div>

        
      {showSheetsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Import from Google Sheets</h2>
              <button onClick={() => setShowSheetsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Google Sheets Link
                </label>
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2 border"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Make sure the sheet sharing is set to "Anyone with the link can view".
                </p>
                {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSheetsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSheetsImport}
                  disabled={!sheetsUrl || isUploading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:bg-green-400"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0 rounded-t-lg">
              <h2 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Tag size={14} /> Brand Name
                  </label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.brandName}
                    onChange={(e) => setFormData({...formData, brandName: e.target.value})}
                    placeholder="e.g. Apple"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Tag size={14} /> Item Name
                  </label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. MacBook Pro M3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setShowAddCategoryInput(true);
                            setFormData(prev => ({ ...prev, category: "" }));
                          } else {
                            setFormData(prev => ({ ...prev, category: e.target.value }));
                            setShowAddCategoryInput(false);
                          }
                        }}
                      >
                        <option value="">Select a category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__new__" className="font-semibold text-blue-600">+ Add New Category...</option>
                      </select>
                      
                      {!showAddCategoryInput && (
                        <button
                          type="button"
                          onClick={() => setShowAddCategoryInput(true)}
                          className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 transition-colors cursor-pointer"
                        >
                          New
                        </button>
                      )}
                    </div>

                    {showAddCategoryInput && (
                      <div className="flex gap-2 p-2 bg-slate-50 border border-slate-200 rounded animate-fadeIn items-center">
                        <input
                          type="text"
                          placeholder="New category name"
                          className="flex-1 p-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newCategoryName.trim()) {
                                handleAddCategory(newCategoryName);
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newCategoryName.trim()) {
                              handleAddCategory(newCategoryName);
                            }
                          }}
                          disabled={!newCategoryName.trim()}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded shadow transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategoryInput(false);
                            setNewCategoryName("");
                          }}
                          className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <IndianRupee size={14} /> Purchase Price
                    </label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={formData.purchasePrice || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({...formData, purchasePrice: val});
                      }}
                      min="0"
                      step="0.01"
                      placeholder="Cost price"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <IndianRupee size={14} /> Selling Price
                    </label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={formData.sellingPrice || formData.price || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({...formData, sellingPrice: val, price: val});
                      }}
                      min="0"
                      step="0.01"
                      placeholder="Retail price"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      GST Rate (%)
                    </label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={formData.gstRate || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setFormData({...formData, gstRate: val});
                      }}
                      min="0"
                      step="0.1"
                      placeholder="e.g. 18"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700">Description</label>
                    <button
                      type="button"
                      onClick={generateAiDescription}
                      disabled={isGeneratingDesc || !formData.name}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition-colors disabled:cursor-not-allowed"
                      title={!formData.name ? "Enter a product name first" : "Auto Generate Description"}
                    >
                      {isGeneratingDesc ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          Auto Generate
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Short description of the item..."
                  />
                  {descError && (
                    <p className="text-xs text-red-500 mt-1">{descError}</p>
                  )}
                  {descWarning && (
                    <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded p-1.5 mt-1.5">{descWarning}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Image size={14} /> Product Image
                  </label>
                  
                  <div className="space-y-3">
                    {/* Upload Area */}
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                      {isUploading ? (
                        <div className="flex flex-col items-center justify-center text-blue-600 gap-2">
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-xs font-medium">Uploading to S3...</span>
                        </div>
                      ) : formData.imageUrl ? (
                        <div className="flex flex-col items-center justify-center gap-2 w-full">
                          <img src={formData.imageUrl?.includes('amazonaws.com') ? `/api/proxy-image?url=${encodeURIComponent(formData.imageUrl)}` : formData.imageUrl} alt="Uploaded preview" className="h-20 object-contain rounded" referrerPolicy="no-referrer" />
                          <span className="text-xs text-green-600 font-medium">Upload successful!</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">{formData.imageUrl}</span>
                          <span className="text-[10px] text-blue-500 hover:underline">Change image</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                          <Upload className="w-8 h-8 text-slate-400" />
                          <span className="text-xs font-medium">Click to upload image to S3</span>
                          <span className="text-[10px] text-slate-400">Supports PNG, JPG, GIF up to 50MB</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload} 
                        disabled={isUploading}
                      />
                    </label>

                    {/* Error message */}
                    {uploadError && (
                      <p className="text-xs text-red-500 font-medium">{uploadError}</p>
                    )}

                    {/* Manual URL entry */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">OR ENTER IMAGE URL MANUALLY</span>
                      <input 
                        type="url" 
                        className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                        placeholder="https://example.com/image.jpg"
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
                <button 
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!formData.name || !formData.category}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <PrintFieldLogo layout="horizontal" iconSize="md" variant="dark" />
            <span className="ml-3.5 bg-indigo-50 text-[#2D1F66] text-[10px] px-2.5 py-1 rounded-md font-semibold font-mono tracking-wider border border-indigo-100">CATALOGUE CREATOR</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{user?.username} ({user?.role})</span>
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 mt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catalogue Management</h1>
            <p className="text-slate-500 mt-1">Add, edit, and manage products for the company catalogue</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search items..."
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
                        <button
              onClick={() => {
                if (cart.length > 0) {
                  downloadCartPdf(cart, user, true);
                  setCart([]);
                }
              }}
              disabled={cart.length === 0}
              className={`flex items-center gap-2 text-white px-4 py-2 rounded-md transition-colors whitespace-nowrap ${cart.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-400 cursor-not-allowed'}`}
            >
              <FileDown className="w-4 h-4" />
              Export PDF {cart.length > 0 && <span className="bg-emerald-800 text-xs px-2 py-0.5 rounded-full">{cart.length}</span>}
            </button>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              id="excel-upload"
              onChange={handleExcelUpload} 
            />
            <label 
              htmlFor="excel-upload"
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </label>

            <button 
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={bulkFileInputRef} 
              onChange={handleBulkImageSelect} 
            />
            <button 
              onClick={() => bulkFileInputRef.current?.click()}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:bg-indigo-400"
              disabled={isUploading}
            >
              <Image className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Bulk Add Images'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden group">
                {item.imageUrl ? (
                  <img src={item.imageUrl?.includes('amazonaws.com') ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}` : item.imageUrl} alt={item.brandName ? `${item.brandName} ${item.name}` : item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Box className="w-12 h-12 text-slate-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => toggleCart(item)} className={`p-2 rounded-full ${cart.some(c => c.id === item.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-700 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                    {cart.some(c => c.id === item.id) ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
                  </button>
                  <button onClick={() => openModal(item)} className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600 hover:bg-blue-50">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-slate-900 line-clamp-1" title={item.brandName ? `${item.brandName} ${item.name}` : item.name}>{item.brandName ? `${item.brandName} ${item.name}` : item.name}</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">
                    {item.category}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mb-4 line-clamp-3 whitespace-pre-line flex-grow">{item.description}</p>
                <div className="space-y-1 mt-auto pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Purchase Price:</span>
                    <span className="font-semibold text-slate-700 flex items-center">
                      <IndianRupee size={12} className="inline mr-0.5 text-slate-400" />
                      {(item.purchasePrice || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900">
                    <span>Selling Price:</span>
                    <span className="text-emerald-600 flex items-center font-mono">
                      <IndianRupee size={14} className="inline mr-0.5 text-emerald-500" />
                      {(item.sellingPrice || item.price || 0).toFixed(2)}
                      {item.gstRate ? <span className="text-xs text-slate-500 ml-1 font-sans">+ {item.gstRate}% GST</span> : null}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-lg border-dashed">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No items found</h3>
              <p className="text-slate-500 mt-1">Try a different search term or add a new item.</p>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-semibold">{editingItem ? 'Edit Item' : (bulkTotal > 0 ? `Bulk Add Item (${bulkTotal - bulkQueue.length + 1} of ${bulkTotal})` : 'Add New Item')}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Tag size={14} /> Item Name
                </label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. MacBook Pro M3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setShowAddCategoryInput(true);
                          setFormData(prev => ({ ...prev, category: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, category: e.target.value }));
                          setShowAddCategoryInput(false);
                        }
                      }}
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__new__" className="font-semibold text-blue-600">+ Add New Category...</option>
                    </select>
                    
                    {!showAddCategoryInput && (
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryInput(true)}
                        className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 transition-colors cursor-pointer"
                      >
                        New
                      </button>
                    )}
                  </div>

                  {showAddCategoryInput && (
                    <div className="flex gap-2 p-2 bg-slate-50 border border-slate-200 rounded animate-fadeIn items-center">
                      <input
                        type="text"
                        placeholder="New category name"
                        className="flex-1 p-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newCategoryName.trim()) {
                              handleAddCategory(newCategoryName);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newCategoryName.trim()) {
                            handleAddCategory(newCategoryName);
                          }
                        }}
                        disabled={!newCategoryName.trim()}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded shadow transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddCategoryInput(false);
                          setNewCategoryName("");
                        }}
                        className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <IndianRupee size={14} /> Purchase Price
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.purchasePrice || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({...formData, purchasePrice: val});
                    }}
                    min="0"
                    step="0.01"
                    placeholder="Cost price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <IndianRupee size={14} /> Selling Price
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.sellingPrice || formData.price || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({...formData, sellingPrice: val, price: val});
                    }}
                    min="0"
                    step="0.01"
                    placeholder="Retail price"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    GST Rate (%)
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.gstRate || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({...formData, gstRate: val});
                    }}
                    min="0"
                    step="0.1"
                    placeholder="e.g. 18"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <button
                    type="button"
                    onClick={generateAiDescription}
                    disabled={isGeneratingDesc || !formData.name}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition-colors disabled:cursor-not-allowed"
                    title={!formData.name ? "Enter a product name first" : "Auto Generate Description"}
                  >
                    {isGeneratingDesc ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Auto Generate
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Short description of the item..."
                />
                {descError && (
                  <p className="text-xs text-red-500 mt-1">{descError}</p>
                )}
                {descWarning && (
                  <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded p-1.5 mt-1.5">{descWarning}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Image size={14} /> Product Image
                </label>
                
                <div className="space-y-3">
                  {/* Upload Area */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center text-blue-600 gap-2">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-xs font-medium">Uploading to S3...</span>
                      </div>
                    ) : formData.imageUrl ? (
                      <div className="flex flex-col items-center justify-center gap-2 w-full">
                        <img src={formData.imageUrl?.includes('amazonaws.com') ? `/api/proxy-image?url=${encodeURIComponent(formData.imageUrl)}` : formData.imageUrl} alt="Uploaded preview" className="h-20 object-contain rounded" referrerPolicy="no-referrer" />
                        <span className="text-xs text-green-600 font-medium">Upload successful!</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-full">{formData.imageUrl}</span>
                        <span className="text-[10px] text-blue-500 hover:underline">Change image</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <span className="text-xs font-medium">Click to upload image to S3</span>
                        <span className="text-[10px] text-slate-400">Supports PNG, JPG, GIF up to 50MB</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                      disabled={isUploading}
                    />
                  </label>

                  {/* Error message */}
                  {uploadError && (
                    <p className="text-xs text-red-500 font-medium">{uploadError}</p>
                  )}

                  {/* Manual URL entry */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">OR ENTER IMAGE URL MANUALLY</span>
                    <input 
                      type="url" 
                      className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                      placeholder="https://example.com/image.jpg"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={!formData.name || !formData.category}
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Size Selection Modal */}
      {sizeModalItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Select Size</h3>
              <p className="text-sm text-gray-500 mt-1">{sizeModalItem.name}</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {sizeModalItem.sizes?.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${selectedSize === size ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button
                onClick={() => { setSizeModalItem(null); setSelectedSize(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToCartWithSize}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
