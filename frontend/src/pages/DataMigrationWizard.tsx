import React, { useState } from 'react';
import { Steps, Button, Upload, Select, Card, Typography, Table, notification, Space, Alert } from 'antd';
import { InboxOutlined, CheckCircleOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { post } from "../api";

const { Step } = Steps;
const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

const DataMigrationWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [entityType, setEntityType] = useState('VENDOR');
  const [file, setFile] = useState<any>(null);
  
  const [batchId, setBatchId] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const erpFields: Record<string, string[]> = {
    VENDOR: ['name', 'email', 'phone', 'gstin', 'address', 'payment_terms', 'currency'],
    ITEM: ['sku', 'name', 'description', 'unit_of_measure', 'category', 'unit_price']
  };

  const handleUpload = async (options: any) => {
    const { file: uploadedFile, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('entity_type', entityType);
    
    try {
      const response = await fetch('http://localhost:8000/api/import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      setBatchId(data.batch_id);
      setFilePath(data.file_path);
      setHeaders(data.headers);
      setFile(uploadedFile);
      onSuccess("Ok");
      setCurrentStep(1);
    } catch (e: any) {
      onError(e);
      notification.error({ message: 'Upload Failed', description: e.message });
    }
  };

  const handleMappingChange = (header: string, field: string) => {
    setMapping(prev => ({ ...prev, [header]: field }));
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await post('/import/validate', {
        batch_id: batchId,
        file_path: filePath,
        mapping: mapping
      });
      setValidationResult(result.data);
      setCurrentStep(2);
    } catch (e) {
      notification.error({ message: 'Validation Failed' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const result = await post('/import/execute', {
        batch_id: batchId,
        file_path: filePath,
        mapping: mapping
      });
      setExecutionResult(result.data);
      setCurrentStep(3);
    } catch (e) {
      notification.error({ message: 'Import Execution Failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Select Target Entity: </Text>
              <Select 
                value={entityType} 
                onChange={setEntityType} 
                style={{ width: 200 }}
                options={[
                  { value: "VENDOR", label: "Vendors" },
                  { value: "ITEM", label: "Items" }
                ]}
              />
            </div>
            <Dragger customRequest={handleUpload} showUploadList={false} accept=".csv, .xlsx">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag Excel/CSV file to this area to upload</p>
              <p className="ant-upload-hint">Support for a single bulk upload. Max size 50MB.</p>
            </Dragger>
          </div>
        );
      case 1:
        return (
          <div style={{ marginTop: 24 }}>
            <Alert message="Map the columns from your uploaded file to the ERP fields." type="info" showIcon style={{ marginBottom: 16 }} />
            {headers.map(header => (
              <div key={header} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 250 }}><Text strong>{header}</Text></div>
                <div style={{ padding: '0 16px' }}>➔</div>
                <div>
                  <Select 
                    style={{ width: 250 }} 
                    placeholder="Select ERP Field (Optional)"
                    onChange={(val) => handleMappingChange(header, val)}
                    allowClear
                    options={erpFields[entityType].map(field => ({ value: field, label: field }))}
                  />
                </div>
              </div>
            ))}
            <Button type="primary" onClick={handleValidate} loading={isValidating} style={{ marginTop: 16 }}>
              Run Validation Pre-check
            </Button>
          </div>
        );
      case 2:
        return (
          <div style={{ marginTop: 24 }}>
            {validationResult?.is_valid ? (
              <Alert message="Validation Passed!" description="No errors found. The data is ready to be imported safely." type="success" showIcon />
            ) : (
              <Alert message={`Validation Failed: ${validationResult?.total_errors} rows have errors.`} type="error" showIcon />
            )}
            
            {validationResult?.errors?.length > 0 && (
              <Table 
                dataSource={validationResult.errors} 
                rowKey="row_number"
                size="small"
                style={{ marginTop: 16 }}
                columns={[
                  { title: 'Row #', dataIndex: 'row_number' },
                  { title: 'Errors', dataIndex: 'error_details', render: (val) => <Text type="danger">{val}</Text> },
                  { title: 'Raw Data', dataIndex: 'raw_data', render: (val) => <Text code>{val}</Text> }
                ]}
              />
            )}
            
            <Space style={{ marginTop: 24 }}>
              <Button onClick={() => setCurrentStep(1)}>Back to Mapping</Button>
              <Button type="primary" danger={!validationResult?.is_valid} onClick={handleExecute} loading={isExecuting}>
                {validationResult?.is_valid ? 'Execute Import (Safe)' : 'Force Execute (Ignore Errors)'}
              </Button>
            </Space>
          </div>
        );
      case 3:
        return (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            {executionResult?.success ? (
              <>
                <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
                <Title level={3}>Import Completed Successfully</Title>
                <Text>Successfully imported {executionResult.success_rows} rows.</Text>
              </>
            ) : (
              <>
                <Title level={3} type="danger">Import Failed & Rolled Back</Title>
                <Text>The transaction was aborted to ensure database integrity. 0 rows were inserted.</Text>
              </>
            )}
            <div style={{ marginTop: 24 }}>
              <Button type="primary" onClick={() => { setCurrentStep(0); setFile(null); }}>Start New Import</Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}><CodeOutlined /> Data Migration Wizard</Title>
      <Text type="secondary">Safely upload and migrate master data from Excel or CSV files into the ERP.</Text>
      
      <Card style={{ marginTop: 24 }}>
        <Steps current={currentStep}>
          <Step title="Upload Data" icon={<InboxOutlined />} />
          <Step title="Column Mapping" />
          <Step title="Validation" />
          <Step title="Execution" icon={<PlayCircleOutlined />} />
        </Steps>
        
        {renderStepContent()}
      </Card>
    </div>
  );
};

export default DataMigrationWizard;
