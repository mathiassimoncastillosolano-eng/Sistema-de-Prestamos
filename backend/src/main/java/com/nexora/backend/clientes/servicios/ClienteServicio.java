package com.nexora.backend.clientes.servicios;

import com.fasterxml.jackson.databind.JsonNode;
import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.clientes.dto.ClienteRespuestaDTO;
import com.nexora.backend.clientes.dto.ConsultaClienteRespuestaDTO;
import com.nexora.backend.clientes.dto.RegistroClienteDTO;
import com.nexora.backend.clientes.entidades.Cliente;
import com.nexora.backend.clientes.excepciones.ClienteException;
import com.nexora.backend.clientes.excepciones.ClienteException.Codigo;
import com.nexora.backend.clientes.repositorios.ClienteRepositorio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;


@Service
public class ClienteServicio {

    /** Tiempo durante el que se reutiliza una consulta para el registro (evita pagar dos veces la misma consulta). */
    static final Duration VIGENCIA_CONSULTA = Duration.ofMinutes(10);

    private final ClienteRepositorio clienteRepositorio;
    private final ApiPeruCliente apiPeru;
    private final Clock reloj;

    /** Consultas recientes por usuario y documento. Solo en memoria, como las sesiones (una sola instancia). */
    private final Map<String, ConsultaReciente> consultas = new ConcurrentHashMap<>();

    private record ConsultaReciente(ConsultaClienteRespuestaDTO datos, Instant vence) { }

    /** Hay dos constructores (el otro es para las pruebas): @Autowired le indica a Spring cuál usar. */
    @Autowired
    public ClienteServicio(ClienteRepositorio clienteRepositorio, ApiPeruCliente apiPeru) {
        this(clienteRepositorio, apiPeru, Clock.systemUTC());
    }

    ClienteServicio(ClienteRepositorio clienteRepositorio, ApiPeruCliente apiPeru, Clock reloj) {
        this.clienteRepositorio = clienteRepositorio;
        this.apiPeru = apiPeru;
        this.reloj = reloj;
    }

    @Transactional(readOnly = true)
    public List<Cliente> listar() {
        return clienteRepositorio.findAll(Sort.by("nombre").ascending());
    }

    @Transactional(readOnly = true)
    public Optional<Cliente> consultar(UUID id) {
        return clienteRepositorio.findById(id);
    }

    /*Consulta */

    public ConsultaClienteRespuestaDTO consultar(String tipo, String numero, UUID perfilId) {
        String documento = numero == null ? "" : numero.trim();
        validarFormato(tipo, documento);
        verificarNoRegistrado(documento);

        ConsultaClienteRespuestaDTO datos = switch (tipo) {
            case "DNI" -> consultarDni(documento);
            case "RUC 10" -> consultarRuc10(documento);
            default -> consultarRuc20(documento);
        };

        limpiarVencidas();
        consultas.put(clave(perfilId, tipo, documento), new ConsultaReciente(datos, reloj.instant().plus(VIGENCIA_CONSULTA)));
        return datos;
    }

    private ConsultaClienteRespuestaDTO consultarDni(String dni) {
        JsonNode persona = apiPeru.consultarDni(dni);
        String nombre = persona == null ? "" : nombreDePersona(persona);
        if (nombre.isEmpty()) {
            throw new ClienteException(Codigo.DOCUMENTO_NO_ENCONTRADO,
                    "No se encontraron datos en RENIEC para el DNI " + dni + ".");
        }
        return new ConsultaClienteRespuestaDTO("DNI", dni, nombre,
                null, null, null, null, null, null, true, null);
    }

    private ConsultaClienteRespuestaDTO consultarRuc10(String ruc) {
        JsonNode contribuyente = consultarRucExistente(ruc);
        String nombre = texto(contribuyente, "nombre_o_razon_social");
        String estado = texto(contribuyente, "estado");
        String condicion = texto(contribuyente, "condicion");

        // RUC 10 = "10" + DNI (8 dígitos) + dígito verificador.
        String dni = ruc.substring(2, 10);
        JsonNode asociado = apiPeru.consultarRucPorDni(dni);
        if (asociado == null) {
            throw new ClienteException(Codigo.RUC_NO_COINCIDE,
                    "El DNI " + dni + " obtenido del RUC no tiene un RUC asociado en SUNAT.");
        }
        String rucDelDni = texto(asociado, "ruc");
        if (!ruc.equals(rucDelDni)) {
            throw new ClienteException(Codigo.RUC_NO_COINCIDE,
                    "El RUC " + ruc + " no corresponde al DNI " + dni + " según SUNAT.");
        }

        String motivo = motivoSunat(estado, condicion);
        return new ConsultaClienteRespuestaDTO("RUC 10", ruc, nombre,
                dni, null, estado, condicion, null, null, motivo == null, motivo);
    }

    private ConsultaClienteRespuestaDTO consultarRuc20(String ruc) {
        JsonNode contribuyente = consultarRucExistente(ruc);
        String razonSocial = texto(contribuyente, "nombre_o_razon_social");
        String domicilio = texto(contribuyente, "direccion_completa");
        if (domicilio.isEmpty()) domicilio = texto(contribuyente, "direccion");
        String estado = texto(contribuyente, "estado");
        String condicion = texto(contribuyente, "condicion");

        String motivo = motivoSunat(estado, condicion);
        String repNombre = null;
        String repDni = null;

        // Si SUNAT ya impide el registro no se consulta (ni se cobra) la lista de representantes.
        if (motivo == null) {
            JsonNode representante = elegirRepresentante(apiPeru.consultarRepresentantes(ruc));
            if (representante != null) {
                repNombre = texto(representante, "nombre");
                repDni = texto(representante, "numero_de_documento");
            }
            if (domicilio.isEmpty()) {
                motivo = "No se puede registrar: SUNAT no reporta domicilio fiscal para este RUC.";
            } else if (representante == null) {
                motivo = "No se puede registrar: SUNAT no reporta un representante legal con DNI para este RUC.";
            }
        }

        return new ConsultaClienteRespuestaDTO("RUC 20", ruc, razonSocial,
                null, vacioANulo(domicilio), estado, condicion, repNombre, repDni, motivo == null, motivo);
    }

    private JsonNode consultarRucExistente(String ruc) {
        JsonNode contribuyente = apiPeru.consultarRuc(ruc);
        if (contribuyente == null || texto(contribuyente, "nombre_o_razon_social").isEmpty()) {
            throw new ClienteException(Codigo.DOCUMENTO_NO_ENCONTRADO,
                    "SUNAT no registra el RUC " + ruc + ".");
        }
        return contribuyente;
    }

    /* Registro */

    public ClienteRespuestaDTO registrar(RegistroClienteDTO dto, Perfil perfil) {
        Agencia agencia = perfil.getAgencia();
        if (agencia == null) {
            throw new ClienteException(Codigo.AGENCIA_NO_ASIGNADA);
        }

        String tipo = dto.getTipoDocumento();
        String documento = dto.getNumeroDocumento().trim();
        validarFormato(tipo, documento);

        // Se reutiliza la consulta que el asesor acaba de ver; si venció, se vuelve a consultar.
        ConsultaClienteRespuestaDTO datos = consultaVigente(perfil.getId(), tipo, documento);
        if (datos == null) {
            datos = consultar(tipo, documento, perfil.getId());
        }

        // El duplicado se comprueba siempre contra la base de datos, justo antes de guardar.
        verificarNoRegistrado(documento);

        if (!datos.habilitado()) {
            throw new ClienteException(Codigo.CLIENTE_NO_HABILITADO, datos.motivo());
        }

        Cliente cliente = new Cliente(
                tipo,
                documento,
                datos.nombre(),
                dto.getTelefono().trim(),
                dto.getCorreo().trim().toLowerCase(Locale.ROOT),
                datos.dniTitular(),
                datos.domicilio(),
                datos.estadoSunat(),
                datos.condicionSunat(),
                datos.representanteNombre(),
                datos.representanteDni(),
                agencia.getId(),
                perfil.getId()
        );

        try {
            cliente = clienteRepositorio.saveAndFlush(cliente);
        } catch (DataIntegrityViolationException e) {
            // Otro asesor lo registró en el mismo instante (índice único de numero_documento).
            if (clienteRepositorio.existsByNumeroDocumento(documento)) {
                throw new ClienteException(Codigo.DOCUMENTO_REGISTRADO);
            }
            throw e;
        }

        consultas.remove(clave(perfil.getId(), tipo, documento));

        // Se relee para obtener los valores que pone la base de datos (numero y creado_en).
        Cliente guardado = clienteRepositorio.findById(cliente.getId()).orElse(cliente);
        return ClienteRespuestaDTO.desde(guardado, agencia.getNombre());
    }

    /* Apoyo */

    private void validarFormato(String tipo, String documento) {
        boolean valido = tipo != null && switch (tipo) {
            case "DNI" -> documento.matches("\\d{8}");
            case "RUC 10" -> documento.matches("10\\d{9}");
            case "RUC 20" -> documento.matches("20\\d{9}");
            default -> false;
        };
        if (!valido) {
            String mensaje = "DNI".equals(tipo)
                    ? "El DNI debe tener exactamente 8 dígitos."
                    : "RUC 10".equals(tipo) || "RUC 20".equals(tipo)
                    ? "El RUC debe tener 11 dígitos y empezar con " + tipo.substring(4) + "."
                    : "Tipo de documento no válido.";
            throw new ClienteException(Codigo.DOCUMENTO_INVALIDO, mensaje);
        }
    }

    private void verificarNoRegistrado(String documento) {
        if (clienteRepositorio.existsByNumeroDocumento(documento)) {
            throw new ClienteException(Codigo.DOCUMENTO_REGISTRADO);
        }
    }

    /** null si SUNAT reporta ACTIVO y HABIDO; si no, el mensaje que explica por qué no se puede registrar. */
    static String motivoSunat(String estado, String condicion) {
        if ("ACTIVO".equalsIgnoreCase(estado) && "HABIDO".equalsIgnoreCase(condicion)) {
            return null;
        }
        return "No se puede registrar: SUNAT reporta el RUC con estado «" + (estado.isEmpty() ? "sin dato" : estado)
                + "» y condición «" + (condicion.isEmpty() ? "sin dato" : condicion)
                + "». Solo se registran contribuyentes con estado ACTIVO y condición HABIDO.";
    }

    /* Prefiere al gerente general; si no hay, el primer representante identificado con DNI */
    static JsonNode elegirRepresentante(JsonNode lista) {
        if (lista == null || !lista.isArray()) return null;
        JsonNode primero = null;
        for (JsonNode r : lista) {
            String tipoDoc = texto(r, "tipo_de_documento").replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
            boolean conDni = (tipoDoc.isEmpty() || tipoDoc.equals("DNI"))
                    && texto(r, "numero_de_documento").matches("\\d{8}")
                    && !texto(r, "nombre").isEmpty();
            if (!conDni) continue;
            if (texto(r, "cargo").toUpperCase(Locale.ROOT).contains("GERENTE GENERAL")) return r;
            if (primero == null) primero = r;
        }
        return primero;
    }

    private static String nombreDePersona(JsonNode p) {
        String completo = texto(p, "nombre_completo");
        if (!completo.isEmpty()) return completo;
        return String.join(" ", texto(p, "nombres"), texto(p, "apellido_paterno"), texto(p, "apellido_materno"))
                .replaceAll("\\s+", " ").trim();
    }

    /** Texto de un campo sin espacios sobrantes; "" si no existe o si SUNAT lo devuelve como "-". */
    static String texto(JsonNode nodo, String campo) {
        String v = nodo.path(campo).asText("").trim().replaceAll("\\s+", " ");
        return v.equals("-") ? "" : v;
    }

    private static String vacioANulo(String v) {
        return v == null || v.isEmpty() ? null : v;
    }

    private ConsultaClienteRespuestaDTO consultaVigente(UUID perfilId, String tipo, String documento) {
        ConsultaReciente c = consultas.get(clave(perfilId, tipo, documento));
        return c != null && c.vence().isAfter(reloj.instant()) ? c.datos() : null;
    }

    private void limpiarVencidas() {
        Instant ahora = reloj.instant();
        consultas.values().removeIf(c -> !c.vence().isAfter(ahora));
    }

    private static String clave(UUID perfilId, String tipo, String documento) {
        return perfilId + "|" + tipo + "|" + documento;
    }
}
