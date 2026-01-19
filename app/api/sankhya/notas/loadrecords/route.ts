
import { NextResponse } from 'next/server'
import { authService } from '@/lib/auth-service'
import { contratosService } from '@/lib/contratos-service'
import axios from 'axios'

async function obterTokenDinamico(idEmpresa: number): Promise<string> {
  console.log(`🔐 Gerando token para empresa ${idEmpresa}`)
  
  const credentials = await contratosService.getSankhyaCredentials(idEmpresa)
  
  console.log(`📋 Tipo de autenticação detectado: ${credentials.authType}`)
  console.log(`📋 Base URL: ${credentials.baseUrl}`)
  
  try {
    if (credentials.authType === 'OAUTH2') {
      // OAuth2
      console.log(`🔑 Usando autenticação OAuth2 para empresa ${idEmpresa}`)
      const authenticateUrl = `${credentials.baseUrl}/authenticate`
      
      const params = new URLSearchParams()
      params.append('grant_type', 'client_credentials')
      params.append('client_id', credentials.clientId)
      params.append('client_secret', credentials.clientSecret)
      
      console.log(`📤 Enviando requisição OAuth2 para: ${authenticateUrl}`)
      
      const response = await axios.post(authenticateUrl, params, {
        headers: {
          'X-Token': credentials.xToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      })
      
      const token = response.data.access_token || response.data.bearerToken || response.data.token
      
      if (!token) {
        console.error('❌ Token OAuth2 não retornado:', response.data)
        throw new Error('Token OAuth2 não retornado pela API Sankhya')
      }
      
      console.log(`✅ Token OAuth2 gerado com sucesso para empresa ${idEmpresa}`)
      return token
      
    } else {
      // Legacy
      console.log(`🔑 Usando autenticação Legacy para empresa ${idEmpresa}`)
      const loginUrl = `${credentials.baseUrl}/login`
      
      console.log(`📤 Enviando requisição Legacy para: ${loginUrl}`)
      console.log(`📋 Username: ${credentials.username}`)
      
      const response = await axios.post(loginUrl, {}, {
        headers: {
          'token': credentials.token,
          'appkey': credentials.appkey,
          'username': credentials.username,
          'password': credentials.password,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      
      const token = response.data.bearerToken || response.data.token
      
      if (!token) {
        console.error('❌ Token Legacy não retornado:', response.data)
        throw new Error('Token Legacy não retornado pela API Sankhya')
      }
      
      console.log(`✅ Token Legacy gerado com sucesso para empresa ${idEmpresa}`)
      return token
    }
  } catch (error: any) {
    console.error('❌ Erro ao gerar token:')
    console.error('   Mensagem:', error.message)
    console.error('   Status:', error.response?.status)
    if (error.response) {
      console.error('   Resposta do servidor:', JSON.stringify(error.response.data, null, 2))
      throw new Error(`Erro no login Sankhya (${credentials.authType}): ${error.response.data?.error || error.response.data?.statusMessage || error.message}`)
    }
    throw new Error(`Falha na autenticação Sankhya (${credentials.authType}): ${error.message}`)
  }
}

async function fazerRequisicaoAutenticada(idEmpresa: number, payload: any) {
  const token = await obterTokenDinamico(idEmpresa)
  const credentials = await contratosService.getSankhyaCredentials(idEmpresa)
  
  const URL_LOADRECORDS = `${credentials.baseUrl}/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json`
  
  try {
    const response = await axios.post(URL_LOADRECORDS, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    
    return response.data
  } catch (error: any) {
    console.error('❌ Erro na requisição Sankhya:', error.response?.data || error.message)
    throw error
  }
}

function mapearEntidades(responseBody: any): any[] {
  const entities = responseBody?.entities?.entity
  if (!entities) return []
  
  const entityArray = Array.isArray(entities) ? entities : [entities]
  const fieldNames = responseBody?.entities?.metadata?.fields?.field?.map((f: any) => f.name) || []
  
  return entityArray.map((rawEntity: any) => {
    const cleanObject: any = {}
    
    for (let i = 0; i < fieldNames.length; i++) {
      const fieldKey = `f${i}`
      const fieldName = fieldNames[i]
      
      if (rawEntity[fieldKey]?.$) {
        cleanObject[fieldName] = rawEntity[fieldKey].$
      }
    }
    
    return cleanObject
  })
}

export async function POST(request: Request) {
  try {
    const { userId, dataInicio, dataFim, idEmpresa, stream } = await request.json()
    
    // Usar idEmpresa do request ou padrão 1
    const empresaId = idEmpresa || 1
    
    console.log(`📋 Buscando notas para empresa ${empresaId}`)
    console.log('📋 Buscando notas Sankhya via loadRecords')
    console.log(`   Empresa: ${empresaId}`)
    console.log(`   Período: ${dataInicio} até ${dataFim}`)
    
    // Se streaming estiver habilitado, retornar SSE
    if (stream) {
      const encoder = new TextEncoder()
      const customReadable = new ReadableStream({
        async start(controller) {
          const sendProgress = (progress: number, message: string) => {
            const data = `data: ${JSON.stringify({ progress, message })}\n\n`
            controller.enqueue(encoder.encode(data))
          }

          try {
            // Etapa 1: Buscar cabeçalhos (0% -> 40%)
            sendProgress(10, 'Buscando cabeçalhos das notas...')
            
            const payloadCabecalho = {
              serviceName: 'CRUDServiceProvider.loadRecords',
              requestBody: {
                dataSet: {
                  rootEntity: 'CabecalhoNota',
                  includePresentationFields: 'N',
                  offsetPage: null,
                  disableRowsLimit: true,
                  entity: {
                    fieldset: {
                      list: 'NUNOTA,DTNEG,CODPARC,CODVEND,VLRNOTA,CODTIPOPER,CODTIPVENDA,NUMNOTA'
                    }
                  },
                  criteria: {
                    expression: {
                      $: `TIPMOV = 'V' AND DTNEG >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND DTNEG <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`
                    }
                  },
                  ordering: {
                    expression: {
                      $: 'DTNEG DESC, NUNOTA DESC'
                    }
                  }
                }
              }
            }
            
            const responseCabecalho = await fazerRequisicaoAutenticada(empresaId, payloadCabecalho)
            const cabecalhos = mapearEntidades(responseCabecalho.responseBody)
            
            sendProgress(40, `${cabecalhos.length} cabeçalhos carregados`)
            
            // Etapa 2: Buscar itens em lotes (40% -> 80%)
            let itens: any[] = []
            
            if (cabecalhos.length > 0) {
              const nunotas = cabecalhos.map((c: any) => c.NUNOTA).filter(Boolean)
              const BATCH_SIZE = 500
              const totalBatches = Math.ceil(nunotas.length / BATCH_SIZE)
              
              for (let i = 0; i < totalBatches; i++) {
                const inicio = i * BATCH_SIZE
                const fim = Math.min(inicio + BATCH_SIZE, nunotas.length)
                const lote = nunotas.slice(inicio, fim)
                
                const progressoParcial = 40 + ((i / totalBatches) * 40)
                sendProgress(progressoParcial, `Carregando lote ${i + 1}/${totalBatches} de itens...`)
                
                const payloadItens = {
                  serviceName: 'CRUDServiceProvider.loadRecords',
                  requestBody: {
                    dataSet: {
                      rootEntity: 'ItemNota',
                      includePresentationFields: 'N',
                      offsetPage: null,
                      disableRowsLimit: true,
                      entity: {
                        fieldset: {
                          list: 'NUNOTA,SEQUENCIA,CODPROD,CODVOL,QTDNEG,VLRUNIT,VLRTOT'
                        }
                      },
                      criteria: {
                        expression: {
                          $: `NUNOTA IN (${lote.join(',')})`
                        }
                      },
                      ordering: {
                        expression: {
                          $: 'NUNOTA, SEQUENCIA'
                        }
                      }
                    }
                  }
                }
                
                const responseItens = await fazerRequisicaoAutenticada(empresaId, payloadItens)
                const itensLote = mapearEntidades(responseItens.responseBody)
                
                itens = [...itens, ...itensLote]
              }
              
              sendProgress(80, `${itens.length} itens carregados`)
            }
            
            // Etapa 3: Finalizar dados (80% -> 100%)
            sendProgress(90, 'Processando dados...')
            
            const resultado = {
              cabecalhos,
              itens,
              periodo: { dataInicio, dataFim },
              totais: {
                totalNotas: cabecalhos.length,
                totalItens: itens.length,
                valorTotal: cabecalhos.reduce((sum: number, c: any) => sum + parseFloat(c.VLRNOTA || 0), 0)
              }
            }
            
            sendProgress(100, 'Concluído!')
            
            // Enviar resultado final
            const finalData = `data: ${JSON.stringify({ ...resultado, complete: true })}\n\n`
            controller.enqueue(encoder.encode(finalData))
            controller.close()
            
          } catch (error: any) {
            const errorData = `data: ${JSON.stringify({ error: error.message, complete: true })}\n\n`
            controller.enqueue(encoder.encode(errorData))
            controller.close()
          }
        }
      })

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }
    
    // Modo normal (sem streaming)
    const payloadCabecalho = {
      serviceName: 'CRUDServiceProvider.loadRecords',
      requestBody: {
        dataSet: {
          rootEntity: 'CabecalhoNota',
          includePresentationFields: 'N',
          offsetPage: null,
          disableRowsLimit: true,
          entity: {
            fieldset: {
              list: 'NUNOTA,DTNEG,CODPARC,CODVEND,VLRNOTA,CODTIPOPER,CODTIPVENDA,NUMNOTA'
            }
          },
          criteria: {
            expression: {
              $: `TIPMOV = 'V' AND DTNEG >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND DTNEG <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`
            }
          },
          ordering: {
            expression: {
              $: 'DTNEG DESC, NUNOTA DESC'
            }
          }
        }
      }
    }
    
    const responseCabecalho = await fazerRequisicaoAutenticada(empresaId, payloadCabecalho)
    const cabecalhos = mapearEntidades(responseCabecalho.responseBody)
    
    console.log(`✅ ${cabecalhos.length} cabeçalhos encontrados`)
    
    let itens: any[] = []
    
    if (cabecalhos.length > 0) {
      const nunotas = cabecalhos.map((c: any) => c.NUNOTA).filter(Boolean)
      const BATCH_SIZE = 500
      const totalBatches = Math.ceil(nunotas.length / BATCH_SIZE)
      
      console.log(`📦 Processando ${nunotas.length} notas em ${totalBatches} lotes`)
      
      for (let i = 0; i < totalBatches; i++) {
        const inicio = i * BATCH_SIZE
        const fim = Math.min(inicio + BATCH_SIZE, nunotas.length)
        const lote = nunotas.slice(inicio, fim)
        
        console.log(`📤 Lote ${i + 1}/${totalBatches}: ${lote.length} NUNOTAs`)
        
        const payloadItens = {
          serviceName: 'CRUDServiceProvider.loadRecords',
          requestBody: {
            dataSet: {
              rootEntity: 'ItemNota',
              includePresentationFields: 'N',
              offsetPage: null,
              disableRowsLimit: true,
              entity: {
                fieldset: {
                  list: 'NUNOTA,SEQUENCIA,CODPROD,CODVOL,QTDNEG,VLRUNIT,VLRTOT'
                }
              },
              criteria: {
                expression: {
                  $: `NUNOTA IN (${lote.join(',')})`
                }
              },
              ordering: {
                expression: {
                  $: 'NUNOTA, SEQUENCIA'
                }
              }
            }
          }
        }
        
        const responseItens = await fazerRequisicaoAutenticada(empresaId, payloadItens)
        const itensLote = mapearEntidades(responseItens.responseBody)
        
        itens = [...itens, ...itensLote]
        console.log(`✅ Lote ${i + 1}/${totalBatches}: ${itensLote.length} itens carregados (Total: ${itens.length})`)
      }
      
      console.log(`✅ Total: ${itens.length} itens encontrados`)
    }
    
    return NextResponse.json({
      cabecalhos,
      itens,
      periodo: { dataInicio, dataFim },
      totais: {
        totalNotas: cabecalhos.length,
        totalItens: itens.length,
        valorTotal: cabecalhos.reduce((sum: number, c: any) => sum + parseFloat(c.VLRNOTA || 0), 0)
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar notas:', error)
    console.error('   Stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Erro ao buscar notas',
        details: error.response?.data || error.toString()
      },
      { status: error.response?.status || 500 }
    )
  }
}
