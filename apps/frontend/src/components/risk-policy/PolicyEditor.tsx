import { useState } from 'react';
import { api } from '@/services/api';
import { SentinelaRiskPolicy } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/AdminPageHeader';
import { TabDefaults } from './TabDefaults';
import { TabBins } from './TabBins';
import { TabRules } from './TabRules';
import { TabFactors } from './TabFactors';
import { TabAdjustments } from './TabAdjustments';
import { TabImport } from './TabImport';

interface Props {
  policy: SentinelaRiskPolicy | null;
  clienteId: string;
  onBack: () => void;
  onSaved: () => void;
}

export const PolicyEditor = ({ policy, clienteId, onBack, onSaved }: Props) => {
  const isNew = !policy;
  const [name, setName] = useState(policy?.name || 'default');
  const [version, setVersion] = useState(policy?.version || 'v1');
  const [isActive, setIsActive] = useState(policy?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [policyId, setPolicyId] = useState(policy?.id || '');

  const handleSaveHeader = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      if (isNew && !policyId) {
        const data = await api.riskPolicyHeader.create(clienteId, { name: name.trim(), version: version.trim(), is_active: isActive });
        setPolicyId(data.id);
        toast.success('Política criada! Configure as abas abaixo.');
      } else {
        await api.riskPolicyHeader.update(policyId, { name: name.trim(), version: version.trim(), is_active: isActive });
        toast.success('Política salva');
      }
    } catch (err: unknown) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-4 animate-fade-in">
      <AdminPageHeader
        title={isNew ? 'Nova Política de Risco' : `Editar: ${policy?.name}`}
        description={isNew ? 'Preencha os dados para criar uma nova política.' : 'Atualize as configurações da política de risco.'}
        icon={ShieldCheck}
        onBack={onBack}
      />

      {/* Header fields */}
      <Card className="card-premium">
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados da Política</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-4">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="default" />
              </div>
              <div className="space-y-4">
                <Label>Versão</Label>
                <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="v1" />
              </div>
              <div className="flex items-end gap-3 pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>{isActive ? 'Ativa' : 'Inativa'}</Label>
                </div>
                <Button onClick={handleSaveHeader} disabled={saving} className="ml-auto">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for child tables */}
      {policyId ? (
        <Card className="card-premium">
          <CardContent className="p-4 sm:p-6">
            <Tabs defaultValue="defaults" className="w-full">
              <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="defaults" className="flex-1 min-w-[90px] text-xs sm:text-sm">Defaults</TabsTrigger>
                <TabsTrigger value="bins" className="flex-1 min-w-[90px] text-xs sm:text-sm">Bins (Faixas)</TabsTrigger>
                <TabsTrigger value="rules" className="flex-1 min-w-[90px] text-xs sm:text-sm">Regras</TabsTrigger>
                <TabsTrigger value="factors" className="flex-1 min-w-[90px] text-xs sm:text-sm">Fatores</TabsTrigger>
                <TabsTrigger value="adjustments" className="flex-1 min-w-[90px] text-xs sm:text-sm">Ajustes PP</TabsTrigger>
                <TabsTrigger value="import" className="flex-1 min-w-[90px] text-xs sm:text-sm">Importar</TabsTrigger>
              </TabsList>
              <Separator className="my-4" />
              <TabsContent value="defaults"><TabDefaults policyId={policyId} /></TabsContent>
              <TabsContent value="bins"><TabBins policyId={policyId} /></TabsContent>
              <TabsContent value="rules"><TabRules policyId={policyId} /></TabsContent>
              <TabsContent value="factors"><TabFactors policyId={policyId} /></TabsContent>
              <TabsContent value="adjustments"><TabAdjustments policyId={policyId} /></TabsContent>
              <TabsContent value="import"><TabImport policyId={policyId} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
          <Card className="card-premium">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Salve a política acima para configurar as abas de detalhes.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onSaved}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Concluir
        </Button>
      </div>
    </div>
  );
};
