import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, X, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";

interface GameWhitelistBlacklistProps {
  // Whitelist data
  gameTypes: string[];
  gameProviders: string[];
  gameNames: string[];
  // Blacklist data
  gameTypesBlacklist: string[];
  gameProvidersBlacklist: string[];
  gameNamesBlacklist: string[];
  gameBlacklistEnabled: boolean;
  gameExclusionRules: string[];
  // Options
  gameTypeOptions: SelectOption[];
  gameProviderOptions: SelectOption[];
  gameNameOptions: SelectOption[];
  gameTypeBlacklistOptions: SelectOption[];
  gameProviderBlacklistOptions: SelectOption[];
  gameNameBlacklistOptions: SelectOption[];
  // Handlers
  onGameTypesChange: (types: string[]) => void;
  onGameProvidersChange: (providers: string[]) => void;
  onGameNamesChange: (names: string[]) => void;
  onGameTypesBlacklistChange: (types: string[]) => void;
  onGameProvidersBlacklistChange: (providers: string[]) => void;
  onGameNamesBlacklistChange: (names: string[]) => void;
  onBlacklistEnabledChange: (enabled: boolean) => void;
  onExclusionRulesChange: (rules: string[]) => void;
  // Options handlers
  onAddGameTypeOption: (option: SelectOption) => void;
  onDeleteGameTypeOption: (value: string) => void;
  onAddGameProviderOption: (option: SelectOption) => void;
  onDeleteGameProviderOption: (value: string) => void;
  onAddGameNameOption: (option: SelectOption) => void;
  onDeleteGameNameOption: (value: string) => void;
  onAddGameTypeBlacklistOption: (option: SelectOption) => void;
  onDeleteGameTypeBlacklistOption: (value: string) => void;
  onAddGameProviderBlacklistOption: (option: SelectOption) => void;
  onDeleteGameProviderBlacklistOption: (value: string) => void;
  onAddGameNameBlacklistOption: (option: SelectOption) => void;
  onDeleteGameNameBlacklistOption: (value: string) => void;
}

export function GameWhitelistBlacklist({
  gameTypes,
  gameProviders,
  gameNames,
  gameTypesBlacklist,
  gameProvidersBlacklist,
  gameNamesBlacklist,
  gameBlacklistEnabled,
  gameExclusionRules,
  gameTypeOptions,
  gameProviderOptions,
  gameNameOptions,
  gameTypeBlacklistOptions,
  gameProviderBlacklistOptions,
  gameNameBlacklistOptions,
  onGameTypesChange,
  onGameProvidersChange,
  onGameNamesChange,
  onGameTypesBlacklistChange,
  onGameProvidersBlacklistChange,
  onGameNamesBlacklistChange,
  onBlacklistEnabledChange,
  onExclusionRulesChange,
  onAddGameTypeOption,
  onDeleteGameTypeOption,
  onAddGameProviderOption,
  onDeleteGameProviderOption,
  onAddGameNameOption,
  onDeleteGameNameOption,
  onAddGameTypeBlacklistOption,
  onDeleteGameTypeBlacklistOption,
  onAddGameProviderBlacklistOption,
  onDeleteGameProviderBlacklistOption,
  onAddGameNameBlacklistOption,
  onDeleteGameNameBlacklistOption,
}: GameWhitelistBlacklistProps) {
  const [newExclusionRule, setNewExclusionRule] = useState("");
  const [whitelistOpen, setWhitelistOpen] = useState(true);
  const [blacklistOpen, setBlacklistOpen] = useState(false);

  // Count summaries
  const whitelistCount = (gameTypes?.length || 0) + (gameProviders?.length || 0) + (gameNames?.length || 0);
  const blacklistCount = (gameTypesBlacklist?.length || 0) + (gameProvidersBlacklist?.length || 0) + (gameNamesBlacklist?.length || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT: Whitelist */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl overflow-hidden">
        <Collapsible open={whitelistOpen} onOpenChange={setWhitelistOpen}>
          <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-emerald-500/5 transition-colors group">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-sm text-emerald-400">Game Diizinkan</span>
              <span className="text-xs text-muted-foreground bg-emerald-500/20 px-2 py-0.5 rounded-full">
                {whitelistCount}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 space-y-4 border-t border-emerald-500/20">
            {/* Jenis Game */}
            <div className="space-y-2">
              <Label className="text-xs">Jenis Game</Label>
              {gameTypes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {gameTypes.map((type, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 border border-emerald-500/40">
                      {gameTypeOptions.find(g => g.value === type)?.label || type}
                      <button type="button" onClick={() => {
                        const updated = [...gameTypes];
                        updated.splice(idx, 1);
                        onGameTypesChange(updated);
                      }} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <SelectWithAddNew
                value=""
                onValueChange={(value) => {
                  if (value && !gameTypes?.includes(value)) {
                    onGameTypesChange([...(gameTypes || []), value]);
                  }
                }}
                options={gameTypeOptions.filter(opt => !gameTypesBlacklist?.includes(opt.value))}
                onAddOption={onAddGameTypeOption}
                onDeleteOption={onDeleteGameTypeOption}
                placeholder="Pilih jenis game"
              />
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label className="text-xs">Provider</Label>
              {gameProviders?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {gameProviders.map((provider, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 border border-emerald-500/40">
                      {gameProviderOptions.find(p => p.value === provider)?.label || provider}
                      <button type="button" onClick={() => {
                        const updated = [...gameProviders];
                        updated.splice(idx, 1);
                        onGameProvidersChange(updated);
                      }} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <SelectWithAddNew
                value=""
                onValueChange={(value) => {
                  if (value && !gameProviders?.includes(value)) {
                    onGameProvidersChange([...(gameProviders || []), value]);
                  }
                }}
                options={gameProviderOptions.filter(opt => !gameProvidersBlacklist?.includes(opt.value))}
                onAddOption={onAddGameProviderOption}
                onDeleteOption={onDeleteGameProviderOption}
                placeholder="Pilih provider"
              />
            </div>

            {/* Nama Game */}
            <div className="space-y-2">
              <Label className="text-xs">Nama Game</Label>
              {gameNames?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {gameNames.map((name, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full text-xs text-emerald-400 border border-emerald-500/40">
                      {gameNameOptions.find(n => n.value === name)?.label || name}
                      <button type="button" onClick={() => {
                        const updated = [...gameNames];
                        updated.splice(idx, 1);
                        onGameNamesChange(updated);
                      }} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <SelectWithAddNew
                value=""
                onValueChange={(value) => {
                  if (value && !gameNames?.includes(value)) {
                    onGameNamesChange([...(gameNames || []), value]);
                  }
                }}
                options={gameNameOptions.filter(opt => !gameNamesBlacklist?.includes(opt.value))}
                onAddOption={onAddGameNameOption}
                onDeleteOption={onDeleteGameNameOption}
                placeholder="Pilih nama game"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* RIGHT: Blacklist */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl overflow-hidden">
        <Collapsible open={blacklistOpen} onOpenChange={setBlacklistOpen}>
          <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-destructive/5 transition-colors group">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-sm text-destructive">Game Dilarang</span>
              {gameBlacklistEnabled && blacklistCount > 0 && (
                <span className="text-xs text-muted-foreground bg-destructive/20 px-2 py-0.5 rounded-full">
                  {blacklistCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={gameBlacklistEnabled}
                onCheckedChange={onBlacklistEnabledChange}
                onClick={(e) => e.stopPropagation()}
              />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 space-y-4 border-t border-destructive/20">
            {gameBlacklistEnabled ? (
              <>
                {/* Warning */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-2">
                  <p className="text-xs text-warning">⚠️ Promo TIDAK berlaku untuk game yang dipilih di sini.</p>
                </div>

                {/* Jenis Game Dilarang */}
                <div className="space-y-2">
                  <Label className="text-xs">Jenis Game</Label>
                  {gameTypesBlacklist?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {gameTypesBlacklist.map((type, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded-full text-xs text-destructive border border-destructive/40">
                          {gameTypeBlacklistOptions.find(g => g.value === type)?.label || type}
                          <button type="button" onClick={() => {
                            const updated = [...gameTypesBlacklist];
                            updated.splice(idx, 1);
                            onGameTypesBlacklistChange(updated);
                          }} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <SelectWithAddNew
                    value=""
                    onValueChange={(value) => {
                      if (value && !gameTypesBlacklist?.includes(value)) {
                        onGameTypesBlacklistChange([...(gameTypesBlacklist || []), value]);
                      }
                    }}
                    options={gameTypeBlacklistOptions.filter(opt => !gameTypes?.includes(opt.value))}
                    onAddOption={onAddGameTypeBlacklistOption}
                    onDeleteOption={onDeleteGameTypeBlacklistOption}
                    placeholder="Pilih jenis game"
                  />
                </div>

                {/* Provider Dilarang */}
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  {gameProvidersBlacklist?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {gameProvidersBlacklist.map((provider, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded-full text-xs text-destructive border border-destructive/40">
                          {gameProviderBlacklistOptions.find(p => p.value === provider)?.label || provider}
                          <button type="button" onClick={() => {
                            const updated = [...gameProvidersBlacklist];
                            updated.splice(idx, 1);
                            onGameProvidersBlacklistChange(updated);
                          }} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <SelectWithAddNew
                    value=""
                    onValueChange={(value) => {
                      if (value && !gameProvidersBlacklist?.includes(value)) {
                        onGameProvidersBlacklistChange([...(gameProvidersBlacklist || []), value]);
                      }
                    }}
                    options={gameProviderBlacklistOptions.filter(opt => !gameProviders?.includes(opt.value))}
                    onAddOption={onAddGameProviderBlacklistOption}
                    onDeleteOption={onDeleteGameProviderBlacklistOption}
                    placeholder="Pilih provider"
                  />
                </div>

                {/* Nama Game Dilarang */}
                <div className="space-y-2">
                  <Label className="text-xs">Nama Game</Label>
                  {gameNamesBlacklist?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {gameNamesBlacklist.map((name, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/20 rounded-full text-xs text-destructive border border-destructive/40">
                          {gameNameBlacklistOptions.find(n => n.value === name)?.label || name}
                          <button type="button" onClick={() => {
                            const updated = [...gameNamesBlacklist];
                            updated.splice(idx, 1);
                            onGameNamesBlacklistChange(updated);
                          }} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <SelectWithAddNew
                    value=""
                    onValueChange={(value) => {
                      if (value && !gameNamesBlacklist?.includes(value)) {
                        onGameNamesBlacklistChange([...(gameNamesBlacklist || []), value]);
                      }
                    }}
                    options={gameNameBlacklistOptions.filter(opt => !gameNames?.includes(opt.value))}
                    onAddOption={onAddGameNameBlacklistOption}
                    onDeleteOption={onDeleteGameNameBlacklistOption}
                    placeholder="Pilih nama game"
                  />
                </div>

                {/* Aturan Pengecualian Khusus */}
                <div className="space-y-2">
                  <Label className="text-xs">Aturan Pengecualian</Label>
                  {gameExclusionRules?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {gameExclusionRules.map((rule, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs text-foreground">
                          {rule}
                          <button type="button" onClick={() => {
                            const updated = [...gameExclusionRules];
                            updated.splice(idx, 1);
                            onExclusionRulesChange(updated);
                          }} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newExclusionRule}
                      onChange={(e) => setNewExclusionRule(e.target.value)}
                      placeholder="Contoh: Semua slot 3 line"
                      className="text-xs h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newExclusionRule.trim()) {
                          e.preventDefault();
                          onExclusionRulesChange([...(gameExclusionRules || []), newExclusionRule.trim()]);
                          setNewExclusionRule('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (newExclusionRule.trim()) {
                          onExclusionRulesChange([...(gameExclusionRules || []), newExclusionRule.trim()]);
                          setNewExclusionRule('');
                        }
                      }}
                      className="h-8 px-2 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Aktifkan toggle untuk mengatur game yang dilarang
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
