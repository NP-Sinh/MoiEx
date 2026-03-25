using System.IO.Compression;
using System.Text;
using DocumentFormat.OpenXml.Packaging;
using ITextDocument = iText.Layout.Document;
using ITextParagraph = iText.Layout.Element.Paragraph;
using ITextImage = iText.Layout.Element.Image;
using ITextPageSize = iText.Kernel.Geom.PageSize;
using iText.Kernel.Pdf;
using iText.IO.Image;
using OxmlParagraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;

namespace MoiEx.Services
{
    public interface IPdfConverterServices
    {
        Task<ConversionResult> ConvertAsync(IEnumerable<(Stream Stream, string FileName, long Size)> inputs, PdfConversionOptions options);
    }

    public class PdfConverterServices : IPdfConverterServices
    {
        public static readonly HashSet<string> ImageExts = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif" };

        public static readonly HashSet<string> DocExts = new(StringComparer.OrdinalIgnoreCase) { ".docx" };

        public static readonly HashSet<string> TextExts = new(StringComparer.OrdinalIgnoreCase) { ".txt", ".csv", ".md" };

        public static readonly HashSet<string> AllSupportedExts;

        static PdfConverterServices()
        {
            AllSupportedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var e in ImageExts) AllSupportedExts.Add(e);
            foreach (var e in DocExts) AllSupportedExts.Add(e);
            foreach (var e in TextExts) AllSupportedExts.Add(e);
        }

        public async Task<ConversionResult> ConvertAsync(IEnumerable<(Stream Stream, string FileName, long Size)> inputs, PdfConversionOptions options)
        {
            var list = inputs.ToList();
            if (list.Count == 0) throw new ArgumentException("Không có file nào.");

            var imageItems = list.Where(f => ImageExts.Contains(System.IO.Path.GetExtension(f.FileName))).ToList();
            var docItems = list.Where(f => !ImageExts.Contains(System.IO.Path.GetExtension(f.FileName))).ToList();

            bool allImages = imageItems.Count == list.Count;
            bool allDocs = docItems.Count == list.Count;

            if (allImages)
            {
                var pdfBytes = await MergeImagesToPdfAsync(list, options);
                var name = list.Count == 1
                    ? System.IO.Path.GetFileNameWithoutExtension(list[0].FileName) + ".pdf"
                    : "merged_images.pdf";
                return new ConversionResult { Data = pdfBytes, FileName = name };
            }

            if (allDocs && list.Count == 1)
            {
                var (stream, fileName, _) = list[0];
                var pdfBytes = await DocumentToPdfAsync(stream, fileName, options);
                return new ConversionResult
                {
                    Data = pdfBytes,
                    FileName = System.IO.Path.GetFileNameWithoutExtension(fileName) + ".pdf"
                };
            }

            var zipBytes = await ConvertManyToZipAsync(list, options);
            return new ConversionResult
            {
                Data = zipBytes,
                FileName = "converted_pdfs.zip",
                ContentType = "application/zip"
            };
        }

        private Task<byte[]> MergeImagesToPdfAsync(List<(Stream Stream, string FileName, long Size)> images, PdfConversionOptions options)
        {
            var ms = new MemoryStream();
            using var writer = new PdfWriter(ms, BuildWriterProps(options));
            using var pdfDoc = new PdfDocument(writer);
            using var document = new ITextDocument(pdfDoc);
            document.SetMargins(0, 0, 0, 0);

            bool firstPage = true;

            foreach (var (stream, fileName, _) in images)
            {
                var imgBytes = ReadAllBytes(stream);
                var imgData = ImageDataFactory.Create(imgBytes);
                var img = new ITextImage(imgData);

                bool landscape = options.PageOrientation == "landscape"
                    || (options.PageOrientation == "auto"
                        && img.GetImageWidth() > img.GetImageHeight());

                var pageSize = landscape ? ITextPageSize.A4.Rotate() : ITextPageSize.A4;

                if (firstPage)
                {
                    pdfDoc.AddNewPage(pageSize);
                    firstPage = false;
                }
                else
                {
                    pdfDoc.AddNewPage(pageSize);
                }

                float pw = pageSize.GetWidth();
                float ph = pageSize.GetHeight();

                img.ScaleToFit(pw, ph)
                   .SetFixedPosition(pdfDoc.GetNumberOfPages(), 0, 0);

                document.Add(img);
            }

            document.Close();
            return Task.FromResult(ms.ToArray());
        }

        private async Task<byte[]> DocumentToPdfAsync(Stream inputStream, string fileName, PdfConversionOptions options)
        {
            var ext = System.IO.Path.GetExtension(fileName);

            if (DocExts.Contains(ext)) return await DocxToPdfAsync(inputStream, options);
            if (TextExts.Contains(ext)) return await TextToPdfAsync(inputStream, options);

            throw new NotSupportedException($"Định dạng '{ext}' không được hỗ trợ.");
        }

        private async Task<byte[]> DocxToPdfAsync(Stream inputStream, PdfConversionOptions options)
        {
            var sb = new StringBuilder();
            using (var docx = WordprocessingDocument.Open(inputStream, false))
            {
                var body = docx.MainDocumentPart?.Document?.Body;
                if (body != null)
                {
                    foreach (var para in body.Elements<OxmlParagraph>())
                        sb.AppendLine(para.InnerText);
                }
            }
            return await StringToPdfAsync(sb.ToString(), options);
        }

        private async Task<byte[]> TextToPdfAsync(Stream inputStream, PdfConversionOptions options)
        {
            using var reader = new StreamReader(inputStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var text = await reader.ReadToEndAsync();
            return await StringToPdfAsync(text, options);
        }

        private Task<byte[]> StringToPdfAsync(string content, PdfConversionOptions options)
        {
            bool landscape = options.PageOrientation == "landscape";
            var pageSize = landscape ? ITextPageSize.A4.Rotate() : ITextPageSize.A4;

            var ms = new MemoryStream();
            using var writer = new PdfWriter(ms, BuildWriterProps(options));
            using var pdfDoc = new PdfDocument(writer);
            using var document = new ITextDocument(pdfDoc, pageSize);
            document.SetMargins(40, 50, 40, 50);

            var font = iText.Kernel.Font.PdfFontFactory.CreateFont(
                iText.IO.Font.Constants.StandardFonts.HELVETICA);

            foreach (var line in content.Split('\n'))
            {
                document.Add(new ITextParagraph(line.TrimEnd('\r'))
                    .SetFont(font).SetFontSize(10).SetMultipliedLeading(1.4f));
            }

            document.Close();
            return Task.FromResult(ms.ToArray());
        }
        private async Task<byte[]> ConvertManyToZipAsync( List<(Stream Stream, string FileName, long Size)> files, PdfConversionOptions options)
        {
            using var zipStream = new MemoryStream();
            using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var (stream, fileName, _) in files)
                {
                    byte[] pdfBytes;

                    if (ImageExts.Contains(System.IO.Path.GetExtension(fileName)))
                    {
                        pdfBytes = await MergeImagesToPdfAsync(
                            new List<(Stream, string, long)> { (stream, fileName, 0) }, options);
                    }
                    else
                    {
                        pdfBytes = await DocumentToPdfAsync(stream, fileName, options);
                    }

                    var outName = System.IO.Path.GetFileNameWithoutExtension(fileName) + ".pdf";
                    var entry = archive.CreateEntry(outName, CompressionLevel.Optimal);
                    using var es = entry.Open();
                    await es.WriteAsync(pdfBytes);
                }
            }
            return zipStream.ToArray();
        }

        private static WriterProperties BuildWriterProps(PdfConversionOptions options)
        {
            var props = new WriterProperties();
            if (options.CompressOutput)
                props.SetCompressionLevel(CompressionConstants.BEST_COMPRESSION);
            return props;
        }

        private static byte[] ReadAllBytes(Stream stream)
        {
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            return ms.ToArray();
        }
    }
    public class PdfConversionOptions
    {
        public bool EnableOcr { get; set; } = false;
        public bool CompressOutput { get; set; } = false;
        public string PageOrientation { get; set; } = "auto";
    }

    public class ConversionResult
    {
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public string FileName { get; set; } = "output.pdf";
        public string ContentType { get; set; } = "application/pdf";
    }
}