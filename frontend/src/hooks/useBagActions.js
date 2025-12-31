import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useBagActions = (authenticatedFetch, onSuccess) => {

    const handleImageAdd = useCallback(async (file, type, selectedBag, setFormData) => {
        const uploadData = new FormData();
        uploadData.append('image', file);

        const loadingToast = toast.loading('Chargement de l\'image...');

        try {
            const resp = await authenticatedFetch(`/api/upload`, {
                method: 'POST',
                body: uploadData
            });
            const data = await resp.json();

            if (data.url) {
                if (selectedBag) {
                    const linkResp = await authenticatedFetch(`/api/bags/${selectedBag.id}/images`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: data.url, type: type || 'other', public_id: data.public_id })
                    });
                    if (linkResp.ok) {
                        const newImg = await linkResp.json();
                        setFormData(prev => ({
                            ...prev,
                            images: Array.isArray(prev.images) ? [...prev.images, newImg] : [newImg]
                        }));
                        onSuccess();
                        toast.success('Image ajoutée', { id: loadingToast });
                    } else {
                        toast.error('Erreur lors du lien de l\'image', { id: loadingToast });
                    }
                } else {
                    setFormData(prev => ({
                        ...prev,
                        images: Array.isArray(prev.images) ? [...prev.images, { url: data.url, type: type || 'other', id: Date.now(), public_id: data.public_id }] : [{ url: data.url, type: type || 'other', id: Date.now(), public_id: data.public_id }]
                    }));
                    toast.success('Image importée', { id: loadingToast });
                }
            } else {
                toast.error('Erreur d\'importation', { id: loadingToast });
            }
        } catch (err) {
            console.error('Upload failed', err);
            toast.error('Échec de l\'envoi', { id: loadingToast });
        }
    }, [authenticatedFetch, onSuccess]);

    const handleImageDelete = useCallback(async (img, setFormData) => {
        if (img.id && img.id < 1000000000) {
            try {
                await authenticatedFetch(`/api/images/${img.id}`, { method: 'DELETE' });
                setFormData(prev => ({
                    ...prev,
                    images: prev.images.filter(i => i.id !== img.id)
                }));
                onSuccess();
                toast.success('Image supprimée');
            } catch (err) {
                console.error('Failed to delete image', err);
                toast.error('Erreur de suppression');
            }
        } else {
            setFormData(prev => ({
                ...prev,
                images: prev.images.filter(i => i.url !== img.url)
            }));
            toast.success('Image retirée');
        }
    }, [authenticatedFetch, onSuccess]);

    const handleSubmit = useCallback(async (formData, selectedBag, closeModal) => {
        const method = selectedBag ? 'PUT' : 'POST';
        const url = selectedBag ? `/api/bags/${selectedBag.id}` : `/api/bags`;

        try {
            const resp = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (resp.ok) {
                const data = await resp.json();
                if (!selectedBag) {
                    await Promise.all(formData.images.map(img =>
                        authenticatedFetch(`/api/bags/${data.id}/images`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: img.url, type: img.type || 'other', public_id: img.public_id })
                        })
                    ));
                    toast.success('Nouveau sac ajouté !');
                } else {
                    toast.success('Modifications enregistrées');
                }
                closeModal();
                onSuccess();
            } else {
                toast.error('Erreur lors de l\'enregistrement');
            }
        } catch (err) {
            console.error('Failed to save bag', err);
            toast.error('Échec de la communication avec le serveur');
        }
    }, [authenticatedFetch, onSuccess]);

    const handleDelete = useCallback(async (id, closeModal) => {
        if (!confirm('Supprimer ce sac ?')) return;
        try {
            const resp = await authenticatedFetch(`/api/bags/${id}`, { method: 'DELETE' });
            if (resp.ok) {
                onSuccess();
                closeModal();
                toast.success('Sac supprimé définitivement');
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (err) {
            console.error('Failed to delete bag', err);
            toast.error('Échec de la suppression');
        }
    }, [authenticatedFetch, onSuccess]);

    return {
        handleImageAdd,
        handleImageDelete,
        handleSubmit,
        handleDelete
    };
};
