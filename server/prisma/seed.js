/**
 * Seed Script - Migração de Auth Profiles
 * - Migra profiles existentes de auth_profiles.json para o banco
 * - Idempotente: pode rodar múltiplas vezes sem duplicar
 * - Roda automaticamente no startup
 */

import prisma from '../registry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedAuthProfiles() {
    console.log('\n🌱 [Seed] Iniciando migração de Auth Profiles...\n');

    try {
        // 1. Ler auth_profiles.json (se existir)
        const authProfilesPath = path.join(__dirname, '../data/auth_profiles.json');
        let authData = {};

        if (fs.existsSync(authProfilesPath)) {
            console.log('📄 [Seed] Encontrado auth_profiles.json, migrando...');
            const fileContent = fs.readFileSync(authProfilesPath, 'utf-8');
            authData = JSON.parse(fileContent);
        } else {
            console.log('⚠️  [Seed] Arquivo auth_profiles.json não encontrado. Nenhum usuário será criado (Resource-Driven Enforcement).');
            authData = {};
        }

        // 1.5 CLEANUP: Remover recurso 'default' antigo se existir
        console.log('🧹 [Seed] Verificando e removendo recursos padrão (legacy)...');
        try {
            await prisma.resource.delete({ where: { name: 'default' } }); // Cascade delete profiles
            console.log('   ✅ Recurso "default" removido com sucesso.');
        } catch (e) {
            // Ignore (doesn't exist)
        }

        let totalMigrated = 0;
        let totalSkipped = 0;

        // 2. Para cada resource no arquivo
        for (const [resourceName, profiles] of Object.entries(authData)) {
            console.log(`\n📦 [Seed] Processando resource: ${resourceName}`);

            // 2.1. Buscar ou criar resource
            let resource = await prisma.resource.findUnique({
                where: { name: resourceName }
            });

            if (!resource) {
                console.log(`   ➕ Criando resource "${resourceName}"`);
                resource = await prisma.resource.create({
                    data: {
                        name: resourceName,
                        type: 'API',
                        isEnabled: true
                    }
                });
            }

            // 2.2. Migrar cada profile
            if (Array.isArray(profiles)) {
                for (const profile of profiles) {
                    // Usar UPSERT para atualizar dados se já existir (garante consistência com JSON)
                    console.log(`   🔄 Sincronizando profile "${profile.label}"`);
                    await prisma.authProfile.upsert({
                        where: {
                            // Precisamos de um composite key ou ID único.
                            // Como ID no JSON pode não existir ou ser "default_company", vamos confiar no ID se fornecido,
                            // ou tentar achar pelo (resourceId + label) se não tiver ID estável.
                            // O schema.prisma não tem composite key unique em (resourceId, label), então upsert direto é difícil sem ID.
                            // Vamos manter a lógica de busca, mas fazer UPDATE.
                            id: profile.id || 'undefined_id_fallback' // Se tiver ID no JSON é fácil
                        },
                        create: {
                            resourceId: resource.id,
                            label: profile.label || 'Sem nome',
                            role: profile.role || 'user',
                            credentials: profile.credentials || {},
                            // Se o profile.id vier do JSON, usamos. Senão o Prisma cria UUID.
                            ...(profile.id ? { id: profile.id } : {})
                        },
                        update: {
                            role: profile.role,
                            credentials: profile.credentials
                        }
                    }).catch(async (e) => {
                        // Fallback se falhar por ID inexistente (ex: se profile.id for undefined ou não bater)
                        // Tentamos buscar por label para atualizar
                        const existing = await prisma.authProfile.findFirst({
                            where: { resourceId: resource.id, label: profile.label }
                        });

                        if (existing) {
                            await prisma.authProfile.update({
                                where: { id: existing.id },
                                data: {
                                    role: profile.role,
                                    credentials: profile.credentials
                                }
                            });
                        } else {
                            // Criar novo se realmente não achou
                            await prisma.authProfile.create({
                                data: {
                                    resourceId: resource.id,
                                    label: profile.label || 'Sem nome',
                                    role: profile.role || 'user',
                                    credentials: profile.credentials || {}
                                }
                            });
                        }
                    });
                    totalMigrated++;
                }
            }
        }

        console.log(`\n✨ [Seed] Migração completa!`);
        console.log(`   📊 Total migrado: ${totalMigrated}`);
        console.log(`   ⏭️  Total pulado (já existe): ${totalSkipped}\n`);

    } catch (error) {
        console.error('❌ [Seed] Erro durante migração:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Executar
seedAuthProfiles()
    .then(() => {
        console.log('✅ [Seed] Processo finalizado com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ [Seed] Processo falhou:', error);
        process.exit(1);
    });
